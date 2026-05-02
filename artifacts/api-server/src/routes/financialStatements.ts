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
import { getPresentedStatementLineAdjustments } from "../lib/presentationAmounts.js";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getReportWithCompany(reportId: string, profileId: string) {
  const [row] = await db
    .select({ report: reportsTable, company: companiesTable })
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

/** Encode account ranges as a compact string: "3000-3999,5000-6999" */
function encodeAccountRanges(ranges: [number, number][] | undefined): string | null {
  if (!ranges || ranges.length === 0) return null;
  return ranges.map(([lo, hi]) => (lo === hi ? `${lo}` : `${lo}-${hi}`)).join(",");
}

/** Detect BRF from legalForm */
function isBrfForm(legalForm: string): boolean {
  const lf = legalForm.toLowerCase();
  return lf.includes("brf") || lf.includes("bostadsrättsförening") || lf.includes("bostadsrattsforening");
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
    const isBrf = isBrfForm(legalForm);
    const { forceCashFlow } = req.body as { forceCashFlow?: boolean };
    const cashFlowRequired = isCashFlowRequired(framework, forceCashFlow);
    const rules = getFrameworkRules(framework);

    // Snapshot previous-year values by lineKey before wiping rows so they can be restored
    const existingLines = await db
      .select({
        lineKey: financialStatementLinesTable.lineKey,
        previousYearAmount: financialStatementLinesTable.previousYearAmount,
        previousYearSource: financialStatementLinesTable.previousYearSource,
      })
      .from(financialStatementLinesTable)
      .where(eq(financialStatementLinesTable.reportId, reportId));

    const prevYearSnapshot = new Map(
      existingLines
        .filter((l) => l.previousYearAmount !== null)
        .map((l) => [l.lineKey, { amount: l.previousYearAmount!, source: l.previousYearSource ?? "manual" }]),
    );

    await db
      .delete(financialStatementLinesTable)
      .where(eq(financialStatementLinesTable.reportId, reportId));

    const allTemplates: LineTemplate[] = [
      ...rules.incomeStatement,
      ...rules.balanceSheet,
      ...(cashFlowRequired ? rules.cashFlow : []),
    ];

    const insertValues = allTemplates.map((t) => {
      const linkedAccountIds = encodeAccountRanges(t.accountRanges);
      const swedishLabel = (isBrf && t.brfLabelOverride) ? t.brfLabelOverride : t.swedishLabel;
      return {
        reportId,
        statementType: t.statementType,
        lineKey: t.lineKey,
        swedishLabel,
        sortOrder: t.sortOrder,
        isSubtotal: t.isSubtotal,
        isTotal: t.isTotal,
        isHeading: t.isHeading,
        calculationMethod: t.calculationMethod,
        linkedAccountIds,
        mappingSource: linkedAccountIds ? "framework_template" : null,
        framework,
      };
    });

    const insertedLines = await db
      .insert(financialStatementLinesTable)
      .values(insertValues)
      .returning();

    // Suggest note references for lines that have a suggestedNoteType
    await db
      .delete(reportNoteReferencesTable)
      .where(eq(reportNoteReferencesTable.reportId, reportId));

    const noteRefInserts = insertedLines
      .map((line) => {
        const template = allTemplates.find((t) => t.lineKey === line.lineKey);
        if (!template?.suggestedNoteType) return null;
        return {
          reportId,
          statementType: line.statementType,
          financialStatementLineId: line.id,
          suggestedNoteType: template.suggestedNoteType,
          referenceStatus: "suggested" as const,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (noteRefInserts.length > 0) {
      await db.insert(reportNoteReferencesTable).values(noteRefInserts);
    }

    // Restore previous-year values from snapshot
    const prevYearRestoreUpdates = insertedLines
      .filter((l) => prevYearSnapshot.has(l.lineKey))
      .map((l) => {
        const snap = prevYearSnapshot.get(l.lineKey)!;
        return db
          .update(financialStatementLinesTable)
          .set({
            previousYearAmount: snap.amount,
            previousYearSource: snap.source as "imported" | "manual" | "previous_report_placeholder",
            updatedAt: new Date(),
          })
          .where(eq(financialStatementLinesTable.id, l.id));
      });
    if (prevYearRestoreUpdates.length > 0) {
      await Promise.all(prevYearRestoreUpdates);
    }

    await logAuditEvent({
      eventType: "financial_statements_generated",
      actorProfileId: profileId,
      companyId: row.company.id,
      payload: { framework, legalForm, isBrf, linesGenerated: insertedLines.length, noteReferencesSuggested: noteRefInserts.length, prevYearRestored: prevYearRestoreUpdates.length },
    });

    await logAuditEvent({
      eventType: "framework_rules_applied",
      actorProfileId: profileId,
      companyId: row.company.id,
      payload: { framework, legalForm, isBrf, cashFlowRequired, forceCashFlow: !!forceCashFlow },
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

    // Attach note reference statuses from report_note_references
    const noteRefs = await db
      .select()
      .from(reportNoteReferencesTable)
      .where(eq(reportNoteReferencesTable.reportId, reportId));

    const noteRefMap = new Map(noteRefs.map((nr) => [nr.financialStatementLineId, nr]));

    // Apply per-lineKey adjustments from active reclassifications with
    // effectType "report_node_only" or "note_and_report_node". The
    // financial-statement export, preview, and reconciliation all read
    // `presentedCurrentYearAmount` so user-approved netting between
    // notes that map to different BR/RR rows is reflected everywhere.
    const adjustments = await getPresentedStatementLineAdjustments(reportId);

    const linesWithNoteRef = filtered.map((line) => {
      const nr = noteRefMap.get(line.id);
      const adj = adjustments.get(line.lineKey);
      const mappedCY =
        line.currentYearAmount === null
          ? null
          : Number(line.currentYearAmount);
      const presented =
        adj && mappedCY !== null
          ? mappedCY + adj.netDelta
          : adj
            ? adj.netDelta
            : mappedCY;
      return {
        ...line,
        noteReferenceStatus: nr?.referenceStatus ?? null,
        suggestedNoteType: nr?.suggestedNoteType ?? null,
        presentedCurrentYearAmount:
          presented === null ? null : presented.toFixed(2),
        reclassificationDelta: adj
          ? {
              inflowsCurrentYear: adj.inflowsCurrentYear.toFixed(2),
              outflowsCurrentYear: adj.outflowsCurrentYear.toFixed(2),
              netDelta: adj.netDelta.toFixed(2),
            }
          : null,
      };
    });

    res.json({
      incomeStatement: linesWithNoteRef.filter((l) => l.statementType === "income_statement"),
      balanceSheet: linesWithNoteRef.filter((l) => l.statementType === "balance_sheet"),
      cashFlow: linesWithNoteRef.filter((l) => l.statementType === "cash_flow"),
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
    if (!existing) { res.status(404).json({ error: "not_found", message: "Statement line not found" }); return; }

    const { noteReferenceText, manualAdjustmentAmount, manualAdjustmentReason } = req.body as {
      noteReferenceText?: string | null;
      manualAdjustmentAmount?: string | null;
      manualAdjustmentReason?: string | null;
    };

    const updateData: Partial<typeof financialStatementLinesTable.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    // ── Note reference update ────────────────────────────────────────────────
    if (noteReferenceText !== undefined) {
      updateData.noteReferenceText = noteReferenceText ?? undefined;

      // Sync report_note_references status
      const [existingRef] = await db
        .select()
        .from(reportNoteReferencesTable)
        .where(eq(reportNoteReferencesTable.financialStatementLineId, lineId));

      if (noteReferenceText) {
        if (existingRef) {
          await db
            .update(reportNoteReferencesTable)
            .set({ referenceStatus: "active", updatedAt: new Date() })
            .where(eq(reportNoteReferencesTable.financialStatementLineId, lineId));
        } else {
          await db.insert(reportNoteReferencesTable).values({
            reportId,
            statementType: existing.statementType,
            financialStatementLineId: lineId,
            referenceStatus: "active",
          });
        }
      } else {
        // Cleared — revert to suggested or not_applicable
        if (existingRef) {
          const newStatus = existingRef.suggestedNoteType ? "suggested" : "not_applicable";
          await db
            .update(reportNoteReferencesTable)
            .set({ referenceStatus: newStatus, updatedAt: new Date() })
            .where(eq(reportNoteReferencesTable.financialStatementLineId, lineId));
        }
      }

      await logAuditEvent({
        eventType: "note_reference_updated",
        actorProfileId: profileId,
        payload: { lineId, lineKey: existing.lineKey, noteReferenceText, reportId },
      });
    }

    // ── Manual adjustment update ─────────────────────────────────────────────
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
        payload: {
          lineId,
          lineKey: existing.lineKey,
          original: existing.currentYearAmount,
          adjusted: manualAdjustmentAmount,
          reason: manualAdjustmentReason,
        },
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
    if (!line) { res.status(404).json({ error: "not_found", message: "Statement line not found" }); return; }

    // Get the note reference for this line
    const [noteRef] = await db
      .select()
      .from(reportNoteReferencesTable)
      .where(eq(reportNoteReferencesTable.financialStatementLineId, lineId));

    // Parse linkedAccountIds ("3000-3999,5000-6999") into source account ranges
    const accountRangeStrings = line.linkedAccountIds
      ? line.linkedAccountIds.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // Each range entry becomes a "source account" descriptor
    // When SIE data is available (Phase 3), these will be joined with real balances
    const sourceAccounts = accountRangeStrings.map((rangeStr) => ({
      accountNumber: rangeStr,
      accountName: `Konton ${rangeStr}`,
      balance: null as string | null,
    }));

    const framework = (row.report.accountingFramework as "K2" | "K3") ?? "K3";
    const rules = getFrameworkRules(framework);
    const allTemplateLines = [...rules.incomeStatement, ...rules.balanceSheet, ...rules.cashFlow];
    const template = allTemplateLines.find((t) => t.lineKey === line.lineKey);

    const suggestedNoteType = noteRef?.suggestedNoteType ?? template?.suggestedNoteType ?? null;
    const noteRefReason = suggestedNoteType
      ? `Rad "${line.lineKey}" → föreslår not av typen "${suggestedNoteType}" (status: ${noteRef?.referenceStatus ?? "ingen referens skapad"})`
      : null;

    res.json({
      lineId: line.id,
      lineKey: line.lineKey,
      swedishLabel: line.swedishLabel,
      calculationMethod: line.calculationMethod,
      mappingSource: line.mappingSource,
      framework: line.framework,
      linkedAccountIds: line.linkedAccountIds,
      suggestedNoteType,
      noteReferenceStatus: noteRef?.referenceStatus ?? null,
      noteReferenceText: line.noteReferenceText,
      isManuallyAdjusted: line.isManuallyAdjusted,
      manualAdjustmentOriginal: line.manualAdjustmentOriginal,
      manualAdjustmentReason: line.manualAdjustmentReason,
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
      values?: Array<{ lineId: string; amount: string; source?: string }>;
    };

    if (!Array.isArray(values) || values.length === 0) {
      res.status(400).json({ error: "invalid_input", message: "values array is required" });
      return;
    }

    let updated = 0;
    for (const entry of values) {
      const source = entry.source ?? "manual";
      const result = await db
        .update(financialStatementLinesTable)
        .set({
          previousYearAmount: entry.amount,
          previousYearSource: source as "imported" | "manual" | "previous_report_placeholder",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(financialStatementLinesTable.id, entry.lineId),
            eq(financialStatementLinesTable.reportId, reportId),
          ),
        )
        .returning();
      if (result.length > 0) updated++;
    }

    await logAuditEvent({
      eventType: "previous_year_value_added",
      actorProfileId: profileId,
      payload: { count: updated, reportId },
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
    const isBrf = isBrfForm(legalForm);

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

    const { accountingFramework, regenerateStatements } = req.body as {
      accountingFramework?: "K2" | "K3";
      regenerateStatements?: boolean;
    };
    if (!accountingFramework || !["K2", "K3"].includes(accountingFramework)) {
      res.status(400).json({ error: "invalid_input", message: "accountingFramework must be K2 or K3" });
      return;
    }

    const oldFramework = row.report.accountingFramework;

    const [updated] = await db
      .update(reportsTable)
      .set({ accountingFramework, updatedAt: new Date() })
      .where(eq(reportsTable.id, reportId))
      .returning();

    // If regenerateStatements is requested, delete existing lines (frontend will re-call generate)
    if (regenerateStatements) {
      await db
        .delete(financialStatementLinesTable)
        .where(eq(financialStatementLinesTable.reportId, reportId));
      await db
        .delete(reportNoteReferencesTable)
        .where(eq(reportNoteReferencesTable.reportId, reportId));
    }

    await logAuditEvent({
      eventType: "framework_rules_applied",
      actorProfileId: profileId,
      payload: { from: oldFramework, to: accountingFramework, regenerateStatements: !!regenerateStatements },
    });

    res.json({ ...updated, companyName: row.company.name });
  },
);

export default router;
