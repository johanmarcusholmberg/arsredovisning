import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  reportsTable,
  companiesTable,
  financialStatementLinesTable,
  reportNoteReferencesTable,
} from "@workspace/db";
import { logAuditEvent } from "../lib/auditLog.js";
import {
  getFrameworkRules,
  isCashFlowRequired,
  buildReportStructure,
  type LineTemplate,
} from "../lib/frameworkRules.js";

const router: IRouter = Router();

// ─── Helper: verify report access ────────────────────────────────────────────

async function getReportWithCompany(reportId: string, profileId: string) {
  const [row] = await db
    .select({
      report: reportsTable,
      company: companiesTable,
    })
    .from(reportsTable)
    .innerJoin(companiesTable, eq(reportsTable.companyId, companiesTable.id))
    .where(
      and(
        eq(reportsTable.id, reportId),
        eq(companiesTable.createdByProfileId, profileId),
      ),
    );
  return row ?? null;
}

// ─── POST /reports/:reportId/financial-statements/generate ───────────────────

router.post(
  "/reports/:reportId/financial-statements/generate",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const framework = (row.report.accountingFramework as "K2" | "K3") ?? "K3";
    const legalForm = row.company.legalForm ?? "AB";
    const cashFlowRequired = isCashFlowRequired(framework);
    const rules = getFrameworkRules(framework);

    // Delete existing statement lines before regenerating
    await db
      .delete(financialStatementLinesTable)
      .where(eq(financialStatementLinesTable.reportId, reportId));

    const allTemplates: LineTemplate[] = [
      ...rules.incomeStatement,
      ...rules.balanceSheet,
      ...(cashFlowRequired ? rules.cashFlow : []),
    ];

    const insertValues = allTemplates.map((t) => ({
      reportId,
      statementType: t.statementType,
      lineKey: t.lineKey,
      swedishLabel: t.swedishLabel,
      sortOrder: t.sortOrder,
      isSubtotal: t.isSubtotal,
      isTotal: t.isTotal,
      isHeading: t.isHeading,
      calculationMethod: t.calculationMethod,
      framework,
    }));

    const insertedLines = await db
      .insert(financialStatementLinesTable)
      .values(insertValues)
      .returning();

    // Suggest note references
    const noteRefInserts = insertedLines
      .filter((line) => {
        const template = allTemplates.find((t) => t.lineKey === line.lineKey);
        return template?.suggestedNoteType !== undefined;
      })
      .map((line) => {
        const template = allTemplates.find((t) => t.lineKey === line.lineKey)!;
        return {
          reportId,
          statementType: line.statementType,
          financialStatementLineId: line.id,
          suggestedNoteType: template.suggestedNoteType!,
          referenceStatus: "suggested" as const,
        };
      });

    await db
      .delete(reportNoteReferencesTable)
      .where(eq(reportNoteReferencesTable.reportId, reportId));

    if (noteRefInserts.length > 0) {
      await db.insert(reportNoteReferencesTable).values(noteRefInserts);
    }

    await logAuditEvent({
      eventType: "financial_statements_generated",
      actorProfileId: profileId,
      companyId: row.company.id,
      payload: { framework, linesGenerated: insertedLines.length, noteReferencesSuggested: noteRefInserts.length },
    });

    await logAuditEvent({
      eventType: "framework_rules_applied",
      actorProfileId: profileId,
      payload: { framework, legalForm },
    });

    req.log.info({ reportId, framework, lines: insertedLines.length }, "Statements generated");

    res.json({
      generated: insertedLines.length,
      framework,
      noteReferencesSuggested: noteRefInserts.length,
      message: `Genererade ${insertedLines.length} rader för ${framework}-ramverk`,
    });
  },
);

// ─── GET /reports/:reportId/financial-statements ─────────────────────────────

router.get(
  "/reports/:reportId/financial-statements",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const framework = (row.report.accountingFramework as "K2" | "K3") ?? "K3";
    const cashFlowRequired = isCashFlowRequired(framework);

    const lines = await db
      .select()
      .from(financialStatementLinesTable)
      .where(eq(financialStatementLinesTable.reportId, reportId))
      .orderBy(financialStatementLinesTable.sortOrder);

    const statementTypeFilter = req.query.statementType as string | undefined;
    const filtered = statementTypeFilter
      ? lines.filter((l) => l.statementType === statementTypeFilter)
      : lines;

    res.json({
      incomeStatement: filtered.filter((l) => l.statementType === "income_statement"),
      balanceSheet: filtered.filter((l) => l.statementType === "balance_sheet"),
      cashFlow: filtered.filter((l) => l.statementType === "cash_flow"),
      cashFlowRequired,
      framework,
      hasAnyLines: lines.length > 0,
    });
  },
);

// ─── PATCH /reports/:reportId/financial-statements/lines/:lineId ──────────────

router.patch(
  "/reports/:reportId/financial-statements/lines/:lineId",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, lineId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const [existing] = await db
      .select()
      .from(financialStatementLinesTable)
      .where(
        and(
          eq(financialStatementLinesTable.id, lineId),
          eq(financialStatementLinesTable.reportId, reportId),
        ),
      );

    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Statement line not found" });
      return;
    }

    const { noteReferenceText, manualAdjustmentAmount, manualAdjustmentReason } = req.body as {
      noteReferenceText?: string | null;
      manualAdjustmentAmount?: string | null;
      manualAdjustmentReason?: string | null;
    };

    const updateData: Partial<typeof financialStatementLinesTable.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (noteReferenceText !== undefined) {
      updateData.noteReferenceText = noteReferenceText ?? undefined;
      await logAuditEvent({
        eventType: "note_reference_updated",
        actorProfileId: profileId,
        payload: { lineId, lineKey: existing.lineKey, noteReferenceText },
      });
    }

    if (manualAdjustmentAmount !== undefined) {
      const isFirst = !existing.isManuallyAdjusted;
      updateData.isManuallyAdjusted = true;
      updateData.currentYearAmount = manualAdjustmentAmount ?? undefined;
      updateData.manualAdjustmentReason = manualAdjustmentReason ?? undefined;
      updateData.manualAdjustmentUserId = profileId;
      updateData.manualAdjustmentAt = new Date();
      if (isFirst && existing.currentYearAmount !== null) {
        updateData.manualAdjustmentOriginal = existing.currentYearAmount;
      }
      await logAuditEvent({
        eventType: isFirst ? "manual_adjustment_created" : "manual_adjustment_updated",
        actorProfileId: profileId,
        payload: { lineId, lineKey: existing.lineKey, original: existing.currentYearAmount, adjusted: manualAdjustmentAmount, reason: manualAdjustmentReason },
      });
    }

    const [updated] = await db
      .update(financialStatementLinesTable)
      .set(updateData)
      .where(eq(financialStatementLinesTable.id, lineId))
      .returning();

    res.json(updated);
  },
);

// ─── GET /reports/:reportId/financial-statements/lines/:lineId/drilldown ─────

router.get(
  "/reports/:reportId/financial-statements/lines/:lineId/drilldown",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, lineId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const [line] = await db
      .select()
      .from(financialStatementLinesTable)
      .where(
        and(
          eq(financialStatementLinesTable.id, lineId),
          eq(financialStatementLinesTable.reportId, reportId),
        ),
      );

    if (!line) {
      res.status(404).json({ error: "not_found", message: "Statement line not found" });
      return;
    }

    const framework = (row.report.accountingFramework as "K2" | "K3") ?? "K3";
    const rules = getFrameworkRules(framework);
    const allLines = [...rules.incomeStatement, ...rules.balanceSheet, ...rules.cashFlow];
    const template = allLines.find((t) => t.lineKey === line.lineKey);

    const linkedIds = line.linkedAccountIds
      ? line.linkedAccountIds.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const sourceAccounts = linkedIds.map((acctId) => ({
      accountNumber: acctId,
      accountName: null,
      balance: "0.00",
    }));

    const noteRefReason = template?.suggestedNoteType
      ? `Rad av typen "${line.lineKey}" → föreslår not av typen "${template.suggestedNoteType}"`
      : null;

    res.json({
      lineId: line.id,
      lineKey: line.lineKey,
      swedishLabel: line.swedishLabel,
      calculationMethod: line.calculationMethod,
      mappingSource: line.mappingSource,
      suggestedNoteType: template?.suggestedNoteType ?? null,
      sourceAccounts,
      noteReferenceReason: noteRefReason,
    });
  },
);

// ─── POST /reports/:reportId/financial-statements/previous-year ───────────────

router.post(
  "/reports/:reportId/financial-statements/previous-year",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const { values } = req.body as {
      values?: Array<{ lineId: string; amount: string; source: string }>;
    };

    if (!Array.isArray(values) || values.length === 0) {
      res.status(400).json({ error: "invalid_input", message: "values array is required" });
      return;
    }

    let updated = 0;
    for (const entry of values) {
      await db
        .update(financialStatementLinesTable)
        .set({
          previousYearAmount: entry.amount,
          previousYearSource: entry.source as "imported" | "manual" | "previous_report_placeholder",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(financialStatementLinesTable.id, entry.lineId),
            eq(financialStatementLinesTable.reportId, reportId),
          ),
        );
      updated++;
    }

    await logAuditEvent({
      eventType: "previous_year_value_added",
      actorProfileId: profileId,
      payload: { count: updated },
    });

    res.json({ updated });
  },
);

// ─── GET /reports/:reportId/report-structure ──────────────────────────────────

router.get(
  "/reports/:reportId/report-structure",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const framework = (row.report.accountingFramework as "K2" | "K3") ?? "K3";
    const legalForm = row.company.legalForm ?? "AB";
    const cashFlowRequired = isCashFlowRequired(framework);
    const isBrf = legalForm.toLowerCase().includes("brf") ||
      legalForm.toLowerCase().includes("bostadsrättsförening");

    const sections = buildReportStructure(framework, legalForm, cashFlowRequired);

    await logAuditEvent({
      eventType: "report_structure_generated",
      actorProfileId: profileId,
      payload: { framework, legalForm, cashFlowRequired, isBrf },
    });

    res.json({ reportId, framework, cashFlowRequired, isBrf, sections });
  },
);

// ─── PATCH /reports/:reportId/framework ───────────────────────────────────────

router.patch(
  "/reports/:reportId/framework",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const { accountingFramework } = req.body as { accountingFramework?: "K2" | "K3" };
    if (!accountingFramework || !["K2", "K3"].includes(accountingFramework)) {
      res.status(400).json({ error: "invalid_input", message: "accountingFramework must be K2 or K3" });
      return;
    }

    const [updated] = await db
      .update(reportsTable)
      .set({ accountingFramework, updatedAt: new Date() })
      .where(eq(reportsTable.id, reportId))
      .returning();

    await logAuditEvent({
      eventType: "framework_rules_applied",
      actorProfileId: profileId,
      payload: { from: row.report.accountingFramework, to: accountingFramework },
    });

    res.json({ ...updated, companyName: row.company.name });
  },
);

export default router;
