/**
 * Cash flow (Kassaflödesanalys) routes — assessment + statement editor +
 * manual adjustments + validation. Every write is audit-logged.
 */

import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import {
  db,
  annualReportProjectsTable,
  cashFlowAccountClassificationsTable,
} from "@workspace/db";
import {
  loadAccountMovements,
  type AccountMovement,
} from "../lib/cashFlowSourceData.js";
import {
  getOrCreateAssessment,
  updateAssessment,
  deriveAssessmentResult,
  shouldIncludeCashFlow,
} from "../lib/cashFlowAssessmentService.js";
import {
  generateCashFlowStatement,
  loadCashFlowStatementByReport,
  updateCashFlowLine,
  recomputeAndPersistTotals,
  addManualAdjustment,
  listAdjustments,
  validateCashFlowStatement,
  setStatementStatus,
  type CashFlowStatementWithLines,
} from "../lib/cashFlowStatementService.js";
import { requireReportAccess } from "../lib/reportAccess.js";
import { resolveProjectForReport } from "../helpers/projectReportLink.js";
import { logAuditEvent, AUDIT_EVENTS } from "../helpers/auditLog.js";

const router: IRouter = Router();

// Reuse existing AUDIT_EVENTS constants — generic event types are sufficient
// for the cash flow lifecycle until explicit ones are added.
const CF_EVENTS = {
  ASSESSMENT_UPDATED: "cash_flow.assessment_updated",
  STATEMENT_GENERATED: "cash_flow.statement_generated",
  LINE_UPDATED: "cash_flow.line_updated",
  ADJUSTMENT_ADDED: "cash_flow.adjustment_added",
  VALIDATED: "cash_flow.validated",
} as const;

void AUDIT_EVENTS; // referenced for future use

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function projectIdForReport(reportId: string): Promise<string | null> {
  const link = await resolveProjectForReport(reportId);
  return link?.projectId ?? null;
}

function shapeStatement(s: CashFlowStatementWithLines | null) {
  if (!s) return { statement: null, lines: [] };
  const num = (v: string | null) => (v === null ? null : Number(v));
  return {
    statement: {
      id: s.statement.id,
      projectId: s.statement.projectId,
      reportId: s.statement.reportId,
      financialYear: s.statement.financialYear,
      method: s.statement.method,
      status: s.statement.status,
      openingCashAndCashEquivalents: num(s.statement.openingCashAndCashEquivalents),
      cashFlowFromOperatingActivities: num(
        s.statement.cashFlowFromOperatingActivities,
      ),
      cashFlowFromInvestingActivities: num(
        s.statement.cashFlowFromInvestingActivities,
      ),
      cashFlowFromFinancingActivities: num(
        s.statement.cashFlowFromFinancingActivities,
      ),
      totalCashFlowForYear: num(s.statement.totalCashFlowForYear),
      closingCashAndCashEquivalents: num(s.statement.closingCashAndCashEquivalents),
      calculatedClosingCashAndCashEquivalents: num(
        s.statement.calculatedClosingCashAndCashEquivalents,
      ),
      reconciliationDifference: num(s.statement.reconciliationDifference),
      hasManualAdjustments: s.statement.hasManualAdjustments,
      validationStatus: s.statement.validationStatus,
    },
    lines: s.lines.map((l) => {
      let sourceAccounts: unknown[] = [];
      if (l.sourceAccounts) {
        try {
          const parsed: unknown = JSON.parse(l.sourceAccounts);
          if (Array.isArray(parsed)) sourceAccounts = parsed;
        } catch {
          // Tolerate legacy non-JSON values silently.
        }
      }
      return {
        id: l.id,
        section: l.section,
        lineCode: l.lineCode,
        labelSv: l.labelSv,
        amountCurrentYear: num(l.amountCurrentYear),
        amountPreviousYear: num(l.amountPreviousYear),
        sourceType: l.sourceType,
        calculationExplanationSv: l.calculationExplanationSv,
        sourceAccounts,
        isEditable: l.isEditable,
        isRequired: l.isRequired,
        isSubtotal: l.isSubtotal,
        needsReview: l.needsReview,
        sortOrder: l.sortOrder,
      };
    }),
  };
}

function shapeAssessment(row: Awaited<ReturnType<typeof getOrCreateAssessment>>) {
  const verdict = deriveAssessmentResult(row);
  // Manual override on the row wins over the recomputed result.
  const requirement =
    row.assessmentStatus === "manually_overridden"
      ? row.cashFlowRequirement
      : verdict.cashFlowRequirement;
  const include = shouldIncludeCashFlow({
    ...row,
    cashFlowRequirement: requirement,
  });
  return {
    id: row.id,
    projectId: row.projectId,
    companyId: row.companyId,
    financialYear: row.financialYear,
    legalForm: row.legalForm,
    reportingFramework: row.reportingFramework,
    reportType: row.reportType,
    isListedCompany: row.isListedCompany,
    isHousingAssociation: row.isHousingAssociation,
    voluntaryEnabled: row.voluntaryEnabled,
    employeesCurrentYear: row.employeesCurrentYear,
    employeesPreviousYear: row.employeesPreviousYear,
    balanceTotalCurrentYear:
      row.balanceTotalCurrentYear === null
        ? null
        : Number(row.balanceTotalCurrentYear),
    balanceTotalPreviousYear:
      row.balanceTotalPreviousYear === null
        ? null
        : Number(row.balanceTotalPreviousYear),
    netRevenueCurrentYear:
      row.netRevenueCurrentYear === null
        ? null
        : Number(row.netRevenueCurrentYear),
    netRevenuePreviousYear:
      row.netRevenuePreviousYear === null
        ? null
        : Number(row.netRevenuePreviousYear),
    thresholdEmployeesMet: row.thresholdEmployeesMet,
    thresholdBalanceTotalMet: row.thresholdBalanceTotalMet,
    thresholdNetRevenueMet: row.thresholdNetRevenueMet,
    largerCompanyAssessment: row.largerCompanyAssessment,
    cashFlowRequirement: requirement,
    assessmentStatus: row.assessmentStatus,
    userOverrideReason: row.userOverrideReason,
    explanationSv: verdict.explanationSv,
    missingInputs: verdict.missingInputs,
    shouldIncludeInExport: include,
  };
}

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

router.get(
  "/reports/:reportId/cash-flow/assessment",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }
    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "view_only");
    if (!access) return;

    const projectId = await projectIdForReport(reportId);
    if (!projectId) { res.status(404).json({ error: "project_not_found" }); return; }

    const row = await getOrCreateAssessment(projectId);
    res.json(shapeAssessment(row));
  },
);

router.patch(
  "/reports/:reportId/cash-flow/assessment",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }
    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "edit_data");
    if (!access) return;

    const projectId = await projectIdForReport(reportId);
    if (!projectId) { res.status(404).json({ error: "project_not_found" }); return; }

    const updated = await updateAssessment(projectId, {
      ...req.body,
      reviewedByUserId: profileId,
    });

    await logAuditEvent({
      eventType: CF_EVENTS.ASSESSMENT_UPDATED,
      projectId,
      companyId: access.company.id,
      actorProfileId: profileId,
      eventData: {
        cashFlowRequirement: updated.cashFlowRequirement,
        assessmentStatus: updated.assessmentStatus,
        voluntaryEnabled: updated.voluntaryEnabled,
      },
    });

    res.json(shapeAssessment(updated));
  },
);

// ---------------------------------------------------------------------------
// Statement
// ---------------------------------------------------------------------------

router.get(
  "/reports/:reportId/cash-flow/statement",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }
    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "view_only");
    if (!access) return;

    const stmt = await loadCashFlowStatementByReport(reportId);
    res.json(shapeStatement(stmt));
  },
);

router.post(
  "/reports/:reportId/cash-flow/statement",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }
    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "edit_data");
    if (!access) return;

    const projectId = await projectIdForReport(reportId);
    if (!projectId) { res.status(404).json({ error: "project_not_found" }); return; }

    // Ensure project exists.
    const [project] = await db
      .select()
      .from(annualReportProjectsTable)
      .where(eq(annualReportProjectsTable.id, projectId))
      .limit(1);
    if (!project) { res.status(404).json({ error: "project_not_found" }); return; }

    const result = await generateCashFlowStatement(projectId);

    await logAuditEvent({
      eventType: CF_EVENTS.STATEMENT_GENERATED,
      projectId,
      companyId: access.company.id,
      actorProfileId: profileId,
      eventData: { statementId: result.statement.id, method: "indirect" },
    });

    res.json(shapeStatement(result));
  },
);

router.patch(
  "/reports/:reportId/cash-flow/lines/:lineId",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }
    const { reportId, lineId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "edit_data");
    if (!access) return;

    const stmt = await loadCashFlowStatementByReport(reportId);
    if (!stmt) { res.status(404).json({ error: "statement_not_generated" }); return; }
    const target = stmt.lines.find((l) => l.id === lineId);
    if (!target) { res.status(404).json({ error: "line_not_found" }); return; }
    if (!target.isEditable) {
      res.status(400).json({ error: "line_not_editable" }); return;
    }

    await updateCashFlowLine(lineId, req.body ?? {});
    const recomputed = await recomputeAndPersistTotals(stmt.statement.id);
    // Any edit invalidates a previously-validated statement — force re-run
    // before it can be exported again.
    if (stmt.statement.status === "validated") {
      await setStatementStatus(stmt.statement.id, "needs_review");
    }
    const refreshed = await loadCashFlowStatementByReport(reportId);
    void recomputed;

    await logAuditEvent({
      eventType: CF_EVENTS.LINE_UPDATED,
      projectId: stmt.statement.projectId,
      companyId: access.company.id,
      actorProfileId: profileId,
      eventData: {
        statementId: stmt.statement.id,
        lineId,
        lineCode: target.lineCode,
      },
    });

    res.json(shapeStatement(refreshed));
  },
);

// ---------------------------------------------------------------------------
// Manual adjustments
// ---------------------------------------------------------------------------

router.get(
  "/reports/:reportId/cash-flow/adjustments",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }
    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "view_only");
    if (!access) return;

    const stmt = await loadCashFlowStatementByReport(reportId);
    if (!stmt) { res.json({ adjustments: [] }); return; }
    const rows = await listAdjustments(stmt.statement.id);
    res.json({
      adjustments: rows.map((r) => ({
        id: r.id,
        cashFlowStatementId: r.cashFlowStatementId,
        lineItemId: r.lineItemId,
        adjustmentAmount: Number(r.adjustmentAmount),
        adjustmentReason: r.adjustmentReason,
        previousAmount: r.previousAmount === null ? null : Number(r.previousAmount),
        newAmount: Number(r.newAmount),
        createdByProfileId: r.createdByProfileId,
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : (r.createdAt as unknown as string),
      })),
    });
  },
);

router.post(
  "/reports/:reportId/cash-flow/adjustments",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }
    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "edit_data");
    if (!access) return;

    const stmt = await loadCashFlowStatementByReport(reportId);
    if (!stmt) { res.status(404).json({ error: "statement_not_generated" }); return; }

    const { lineId, newAmount, reason } = req.body ?? {};
    if (!lineId || typeof newAmount !== "number" || !reason || String(reason).trim().length < 3) {
      res.status(400).json({ error: "invalid_request" }); return;
    }

    try {
      await addManualAdjustment(stmt.statement.id, {
        lineId,
        newAmount,
        reason,
        createdByProfileId: profileId,
      });
    } catch (err) {
      res.status(400).json({ error: "adjustment_failed", message: (err as Error).message });
      return;
    }

    const recomputedAdj = await recomputeAndPersistTotals(stmt.statement.id);
    if (stmt.statement.status === "validated") {
      await setStatementStatus(stmt.statement.id, "needs_review");
    }
    const refreshed = await loadCashFlowStatementByReport(reportId);
    void recomputedAdj;

    await logAuditEvent({
      eventType: CF_EVENTS.ADJUSTMENT_ADDED,
      projectId: stmt.statement.projectId,
      companyId: access.company.id,
      actorProfileId: profileId,
      eventData: { statementId: stmt.statement.id, lineId, newAmount, reason },
    });

    res.json(shapeStatement(refreshed));
  },
);

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

router.post(
  "/reports/:reportId/cash-flow/validate",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }
    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "edit_data");
    if (!access) return;

    const stmt = await loadCashFlowStatementByReport(reportId);
    if (!stmt) { res.status(404).json({ error: "statement_not_generated" }); return; }

    // Ensure totals are fresh first.
    const refreshed = await recomputeAndPersistTotals(stmt.statement.id);
    const result = await validateCashFlowStatement(stmt.statement.id);
    const blocking = result.issues.filter((i) => i.level === "blocking").length;
    const newStatus = blocking === 0 ? "validated" : "needs_review";
    const updated = await setStatementStatus(stmt.statement.id, newStatus);

    await logAuditEvent({
      eventType: CF_EVENTS.VALIDATED,
      projectId: stmt.statement.projectId,
      companyId: access.company.id,
      actorProfileId: profileId,
      eventData: { statementId: stmt.statement.id, status: newStatus, blocking },
    });

    res.json({
      reconciled: result.reconciled,
      matchesBalanceSheet: result.matchesBalanceSheet,
      issues: result.issues,
      statement: shapeStatement({ statement: updated, lines: refreshed.lines }).statement,
    });
  },
);

// ---------------------------------------------------------------------------
// Per-account cash-flow classifications
// ---------------------------------------------------------------------------

function shapeMovement(m: AccountMovement) {
  return {
    accountNumber: m.accountNumber,
    accountName: m.accountName,
    openingBalance: m.openingBalance,
    closingBalance: m.closingBalance,
    movement: m.movement,
    fsReportLine: m.fsReportLine,
    fsReportLineLabel: m.fsReportLineLabel,
    classification: m.classification,
    classificationSource: m.classificationSource,
    confidence: m.confidence,
    excludeFromCashFlow: m.excludeFromCashFlow,
    needsManualReview: m.needsManualReview,
    reviewReasonSv: m.reviewReasonSv,
    isUserOverridden: m.isUserOverridden,
  };
}

router.get(
  "/reports/:reportId/cash-flow/account-classifications",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }
    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "view_only");
    if (!access) return;

    const projectId = await projectIdForReport(reportId);
    if (!projectId) { res.status(404).json({ error: "project_not_found" }); return; }

    const bundle = await loadAccountMovements(projectId);
    res.json({
      hasAccountLevelData: bundle.hasAccountLevelData,
      accounts: bundle.all
        .slice()
        .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))
        .map(shapeMovement),
    });
  },
);

router.patch(
  "/reports/:reportId/cash-flow/account-classifications/:accountNumber",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }
    const { reportId, accountNumber } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "edit_data");
    if (!access) return;

    const projectId = await projectIdForReport(reportId);
    if (!projectId) { res.status(404).json({ error: "project_not_found" }); return; }

    const body = req.body as {
      classification?: string;
      excludeFromCashFlow?: boolean;
      needsManualReview?: boolean;
      reviewReasonSv?: string | null;
      notes?: string | null;
    };

    if (!body.classification && body.excludeFromCashFlow === undefined) {
      res.status(400).json({ error: "classification_or_exclude_required" });
      return;
    }

    const ALLOWED_CLASSIFICATIONS = new Set([
      "cash_and_cash_equivalents",
      "receivables",
      "inventory",
      "operating_liabilities",
      "tax",
      "non_cash_adjustment",
      "tangible_fixed_assets",
      "intangible_fixed_assets",
      "financial_fixed_assets",
      "long_term_loans",
      "short_term_interest_bearing_loans",
      "equity",
      "dividends",
      "other_unclear",
      "exclude",
    ]);
    if (
      body.classification !== undefined &&
      !ALLOWED_CLASSIFICATIONS.has(body.classification)
    ) {
      res.status(400).json({ error: "invalid_classification" });
      return;
    }

    const [existing] = await db
      .select()
      .from(cashFlowAccountClassificationsTable)
      .where(
        and(
          eq(cashFlowAccountClassificationsTable.projectId, projectId),
          eq(cashFlowAccountClassificationsTable.accountNumber, accountNumber),
        ),
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "account_not_found" });
      return;
    }

    const [updated] = await db
      .update(cashFlowAccountClassificationsTable)
      .set({
        classification:
          (body.classification as typeof existing.classification | undefined) ??
          existing.classification,
        classificationSource: "manual_override",
        confidence: "high",
        excludeFromCashFlow:
          body.excludeFromCashFlow ?? existing.excludeFromCashFlow,
        needsManualReview: body.needsManualReview ?? false,
        reviewReasonSv:
          body.reviewReasonSv === undefined
            ? null
            : body.reviewReasonSv,
        notes: body.notes === undefined ? existing.notes : body.notes,
        overriddenByProfileId: profileId,
        overriddenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(cashFlowAccountClassificationsTable.id, existing.id))
      .returning();

    await logAuditEvent({
      eventType: "cash_flow.account_classification_overridden",
      projectId,
      companyId: access.company.id,
      actorProfileId: profileId,
      eventData: {
        accountNumber,
        classification: updated.classification,
        excludeFromCashFlow: updated.excludeFromCashFlow,
      },
    });

    // Regenerate statement so derivation reflects the override.
    const stmt = await loadCashFlowStatementByReport(reportId);
    if (stmt) {
      await generateCashFlowStatement(projectId);
      // If previously validated, downgrade to needs_review.
      if (stmt.statement.status === "validated") {
        await setStatementStatus(stmt.statement.id, "needs_review");
      }
    }

    void asc; // keep import alive for future ordered queries
    res.json({
      account: shapeMovement({
        accountNumber: updated.accountNumber,
        accountName: updated.accountName,
        openingBalance: null,
        closingBalance: null,
        movement: null,
        fsReportLine: null,
        fsReportLineLabel: null,
        classification: updated.classification,
        classificationSource: updated.classificationSource,
        confidence: updated.confidence,
        excludeFromCashFlow: updated.excludeFromCashFlow,
        needsManualReview: updated.needsManualReview,
        reviewReasonSv: updated.reviewReasonSv,
        isUserOverridden: true,
      }),
    });
  },
);

export default router;
