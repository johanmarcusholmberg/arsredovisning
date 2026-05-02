import { Router, type IRouter } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  db,
  reportsTable,
  companiesTable,
  reportNotesTable,
  reportNoteRowsTable,
  accountMappingsTable,
  stagingAccountsTable,
  importBatchesTable,
  annualReportProjectsTable,
} from "@workspace/db";
import { logAuditEvent } from "../lib/auditLog.js";
import { reconcileNotes } from "../lib/noteReconciliation.js";

const router: IRouter = Router();

// ─── Auth helpers (same shape as notes.ts) ───────────────────────────────────

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

/**
 * Resolve the annual_report_projects row for a given report. Reports are
 * keyed by (companyId, fiscalYearStart, fiscalYearEnd), so we look up the
 * project that matches that triple. Returns null when no project exists yet
 * (e.g. report created before any import).
 */
async function getProjectIdForReport(
  companyId: string,
  fiscalYearStart: string,
  fiscalYearEnd: string,
): Promise<string | null> {
  const [proj] = await db
    .select({ id: annualReportProjectsTable.id })
    .from(annualReportProjectsTable)
    .where(
      and(
        eq(annualReportProjectsTable.companyId, companyId),
        eq(annualReportProjectsTable.fiscalYearStart, fiscalYearStart),
        eq(annualReportProjectsTable.fiscalYearEnd, fiscalYearEnd),
      ),
    );
  return proj?.id ?? null;
}

async function getNote(noteId: string, reportId: string) {
  const [n] = await db
    .select()
    .from(reportNotesTable)
    .where(
      and(
        eq(reportNotesTable.id, noteId),
        eq(reportNotesTable.reportId, reportId),
      ),
    );
  return n ?? null;
}

// ─── Drilldown helper ────────────────────────────────────────────────────────

interface AccountRange {
  from: number;
  to: number;
}

function parseRanges(input: unknown): AccountRange[] {
  if (!Array.isArray(input)) return [];
  const ranges: AccountRange[] = [];
  for (const r of input) {
    if (typeof r === "string") {
      const m = r.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (m) {
        ranges.push({ from: Number(m[1]), to: Number(m[2]) });
        continue;
      }
      const single = Number(r);
      if (!Number.isNaN(single)) ranges.push({ from: single, to: single });
    } else if (
      r &&
      typeof r === "object" &&
      "from" in r &&
      "to" in r &&
      typeof (r as { from: unknown }).from === "number" &&
      typeof (r as { to: unknown }).to === "number"
    ) {
      ranges.push({ from: (r as AccountRange).from, to: (r as AccountRange).to });
    }
  }
  return ranges;
}

interface DrilldownAccount {
  accountNumber: string;
  accountName: string;
  currentYearAmount: string | null;
  previousYearAmount: string | null;
}

/**
 * Resolve the source accounts that feed a row. Looks up the account_mappings
 * for the report's project and returns those whose account number falls in any
 * of the row's source ranges or matches a sourceAccountId entry.
 */
async function resolveDrilldown(
  projectId: string | null,
  ranges: AccountRange[],
  explicitIds: string[],
): Promise<DrilldownAccount[]> {
  if (!projectId) return [];
  if (ranges.length === 0 && explicitIds.length === 0) return [];

  // Pull all confirmed-batch mappings for the project (auto-mapper writes
  // these once a batch is confirmed; cancelled batches should be excluded).
  const mappings = await db
    .select({
      accountNumber: accountMappingsTable.accountNumber,
      accountName: accountMappingsTable.accountName,
      batchId: accountMappingsTable.batchId,
    })
    .from(accountMappingsTable)
    .where(eq(accountMappingsTable.projectId, projectId));

  if (mappings.length === 0) return [];

  // Filter out cancelled batches
  const batchIds = [...new Set(mappings.map((m) => m.batchId))];
  const batches = await db
    .select({ id: importBatchesTable.id, status: importBatchesTable.status })
    .from(importBatchesTable)
    .where(inArray(importBatchesTable.id, batchIds));
  const activeBatchIds = new Set(
    batches.filter((b) => b.status !== "cancelled").map((b) => b.id),
  );

  const filtered = mappings.filter((m) => {
    if (!activeBatchIds.has(m.batchId)) return false;
    if (explicitIds.length > 0 && explicitIds.includes(m.accountNumber)) return true;
    if (ranges.length === 0) return false;
    const num = Number(m.accountNumber);
    if (Number.isNaN(num)) return false;
    return ranges.some((r) => num >= r.from && num <= r.to);
  });

  if (filtered.length === 0) return [];

  // Pull staging-account balances to populate amount columns
  const accountNumbers = [...new Set(filtered.map((f) => f.accountNumber))];
  const balances = await db
    .select()
    .from(stagingAccountsTable)
    .where(
      and(
        eq(stagingAccountsTable.projectId, projectId),
        inArray(stagingAccountsTable.accountNumber, accountNumbers),
      ),
    );
  const balByNumber = new Map<string, { closing: string | null; opening: string | null }>();
  for (const b of balances) {
    if (!activeBatchIds.has(b.batchId)) continue;
    balByNumber.set(b.accountNumber, {
      closing: b.closingBalance,
      opening: b.openingBalance,
    });
  }

  // De-duplicate by account number, picking the first mapping
  const seen = new Set<string>();
  const result: DrilldownAccount[] = [];
  for (const m of filtered) {
    if (seen.has(m.accountNumber)) continue;
    seen.add(m.accountNumber);
    const bal = balByNumber.get(m.accountNumber);
    result.push({
      accountNumber: m.accountNumber,
      accountName: m.accountName ?? "—",
      currentYearAmount: bal?.closing ?? null,
      previousYearAmount: bal?.opening ?? null,
    });
  }
  result.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
  return result;
}

// ─── GET /reports/:reportId/notes/:noteId/rows ───────────────────────────────

router.get(
  "/reports/:reportId/notes/:noteId/rows",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, noteId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found" }); return; }

    const note = await getNote(noteId, reportId);
    if (!note) { res.status(404).json({ error: "not_found", message: "Note not found" }); return; }

    const rows = await db
      .select()
      .from(reportNoteRowsTable)
      .where(eq(reportNoteRowsTable.noteId, noteId))
      .orderBy(asc(reportNoteRowsTable.sortOrder), asc(reportNoteRowsTable.createdAt));

    // Build drilldown map for every row that has source ranges or ids
    const drilldown: Record<string, DrilldownAccount[]> = {};
    const projectId = await getProjectIdForReport(
      row.report.companyId,
      row.report.fiscalYearStart,
      row.report.fiscalYearEnd,
    );
    for (const r of rows) {
      const ranges = parseRanges(r.sourceAccountRanges);
      const ids = Array.isArray(r.sourceAccountIds)
        ? (r.sourceAccountIds as unknown[]).filter((v): v is string => typeof v === "string")
        : [];
      if (ranges.length === 0 && ids.length === 0) {
        drilldown[r.id] = [];
        continue;
      }
      drilldown[r.id] = await resolveDrilldown(projectId, ranges, ids);
    }

    res.json({ rows, drilldown });
  },
);

// ─── POST /reports/:reportId/notes/:noteId/rows ──────────────────────────────

router.post(
  "/reports/:reportId/notes/:noteId/rows",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, noteId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found" }); return; }

    const note = await getNote(noteId, reportId);
    if (!note) { res.status(404).json({ error: "not_found", message: "Note not found" }); return; }

    const body = req.body as {
      rowKey?: string;
      label?: string;
      currentYearAmount?: string | null;
      previousYearAmount?: string | null;
      isSubtotal?: boolean;
      sortOrder?: number;
      sourceAccountRanges?: unknown;
      calculationNote?: string | null;
    };

    if (!body.rowKey || !body.label) {
      res.status(400).json({ error: "invalid_input", message: "rowKey and label are required" });
      return;
    }

    const [inserted] = await db
      .insert(reportNoteRowsTable)
      .values({
        noteId,
        rowKey: body.rowKey,
        label: body.label,
        currentYearAmount: body.currentYearAmount ?? null,
        previousYearAmount: body.previousYearAmount ?? null,
        isSubtotal: body.isSubtotal ?? false,
        isManual: true,
        sourceAccountRanges: body.sourceAccountRanges ?? null,
        calculationNote: body.calculationNote ?? null,
        sortOrder: body.sortOrder ?? 100,
      })
      .returning();

    await logAuditEvent({
      eventType: "note_row_created",
      actorProfileId: profileId,
      companyId: row.company.id,
      payload: { noteId, rowId: inserted.id, manual: true },
    });

    res.status(201).json(inserted);
  },
);

// ─── PATCH /reports/:reportId/notes/:noteId/rows/:rowId ──────────────────────

router.patch(
  "/reports/:reportId/notes/:noteId/rows/:rowId",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, noteId, rowId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found" }); return; }

    const note = await getNote(noteId, reportId);
    if (!note) { res.status(404).json({ error: "not_found", message: "Note not found" }); return; }

    const body = req.body as {
      label?: string;
      currentYearAmount?: string | null;
      previousYearAmount?: string | null;
      isSubtotal?: boolean;
      sortOrder?: number;
      sourceAccountRanges?: unknown;
      calculationNote?: string | null;
    };

    const update: Partial<typeof reportNoteRowsTable.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (body.label !== undefined) update.label = body.label;
    if (body.currentYearAmount !== undefined) update.currentYearAmount = body.currentYearAmount;
    if (body.previousYearAmount !== undefined) update.previousYearAmount = body.previousYearAmount;
    if (body.isSubtotal !== undefined) update.isSubtotal = body.isSubtotal;
    if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder;
    if (body.sourceAccountRanges !== undefined) update.sourceAccountRanges = body.sourceAccountRanges;
    if (body.calculationNote !== undefined) update.calculationNote = body.calculationNote;

    const [updated] = await db
      .update(reportNoteRowsTable)
      .set(update)
      .where(and(
        eq(reportNoteRowsTable.id, rowId),
        eq(reportNoteRowsTable.noteId, noteId),
      ))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Row not found" });
      return;
    }

    await logAuditEvent({
      eventType: "note_row_updated",
      actorProfileId: profileId,
      companyId: row.company.id,
      payload: { noteId, rowId },
    });

    res.json(updated);
  },
);

// ─── DELETE /reports/:reportId/notes/:noteId/rows/:rowId ─────────────────────

router.delete(
  "/reports/:reportId/notes/:noteId/rows/:rowId",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, noteId, rowId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found" }); return; }

    const note = await getNote(noteId, reportId);
    if (!note) { res.status(404).json({ error: "not_found", message: "Note not found" }); return; }

    const result = await db
      .delete(reportNoteRowsTable)
      .where(and(
        eq(reportNoteRowsTable.id, rowId),
        eq(reportNoteRowsTable.noteId, noteId),
      ))
      .returning({ id: reportNoteRowsTable.id });

    if (result.length === 0) {
      res.status(404).json({ error: "not_found", message: "Row not found" });
      return;
    }

    await logAuditEvent({
      eventType: "note_row_deleted",
      actorProfileId: profileId,
      companyId: row.company.id,
      payload: { noteId, rowId },
    });

    res.json({ deleted: true });
  },
);

// ─── POST /reports/:reportId/notes/:noteId/rows/recompute ────────────────────
//
// Placeholder for the future automated row generator. For now it returns the
// existing rows untouched but the endpoint is wired so the UI can call it and
// surface a clear "no automated rows yet" affordance instead of failing.

router.post(
  "/reports/:reportId/notes/:noteId/rows/recompute",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, noteId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found" }); return; }

    const note = await getNote(noteId, reportId);
    if (!note) { res.status(404).json({ error: "not_found", message: "Note not found" }); return; }

    const rows = await db
      .select()
      .from(reportNoteRowsTable)
      .where(eq(reportNoteRowsTable.noteId, noteId))
      .orderBy(asc(reportNoteRowsTable.sortOrder), asc(reportNoteRowsTable.createdAt));

    res.json({ rows, drilldown: {} });
  },
);

// ─── POST /reports/:reportId/notes/:noteId/confirm ───────────────────────────

router.post(
  "/reports/:reportId/notes/:noteId/confirm",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, noteId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found" }); return; }

    const existing = await getNote(noteId, reportId);
    if (!existing) { res.status(404).json({ error: "not_found", message: "Note not found" }); return; }

    const body = (req.body ?? {}) as { confirmed?: boolean; comment?: string | null };
    const confirmed = body.confirmed ?? true;

    const [updated] = await db
      .update(reportNotesTable)
      .set({
        confirmedByUser: confirmed,
        confirmedByProfileId: confirmed ? profileId : null,
        confirmedAt: confirmed ? new Date() : null,
        confirmationComment: body.comment ?? null,
        // Once confirmed, mark the note as fully complete so the dashboard
        // counters move forward.
        status: confirmed && existing.acceptedText
          ? "complete"
          : existing.status,
        updatedAt: new Date(),
      })
      .where(eq(reportNotesTable.id, noteId))
      .returning();

    await logAuditEvent({
      eventType: confirmed ? "note_confirmed" : "note_confirmation_revoked",
      actorProfileId: profileId,
      companyId: row.company.id,
      payload: { noteId, hasComment: !!body.comment },
    });

    res.json(updated);
  },
);

// ─── GET /reports/:reportId/notes/reconciliation ─────────────────────────────

router.get(
  "/reports/:reportId/notes/reconciliation",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found" }); return; }

    const result = await reconcileNotes(reportId);
    res.json(result);
  },
);

export default router;
