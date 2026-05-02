import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  annualReportReclassificationsTable,
  reportNoteRowsTable,
  reportNotesTable,
} from "@workspace/db";

/**
 * Presentation amounts helper — Phase 6.5.
 *
 * The "presented" amount of any note row is:
 *   finalAmount = mappedAmount
 *               + sum(active reclassifications targeting this row)
 *               - sum(active reclassifications sourced from this row)
 *
 * Imported / mapped data is NEVER mutated. Rejected and undone
 * reclassifications never affect presented amounts. Preview, export, and
 * statement reconciliation all read presented amounts via this helper so
 * they always show the same number.
 */

export interface PresentedNoteRowAmount {
  rowId: string;
  noteId: string;
  mappedCurrentYearAmount: string | null;
  presentedCurrentYearAmount: string | null;
  inflowsCurrentYear: string;
  outflowsCurrentYear: string;
  hasReclassifications: boolean;
}

function toNum(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compute presented amounts for every note row in a report.
 * The map key is the row id.
 */
export async function getPresentedNoteRowAmounts(
  reportId: string,
): Promise<Map<string, PresentedNoteRowAmount>> {
  // Pull active reclassifications for this report.
  const reclasses = await db
    .select()
    .from(annualReportReclassificationsTable)
    .where(
      and(
        eq(annualReportReclassificationsTable.reportId, reportId),
        eq(annualReportReclassificationsTable.status, "active"),
      ),
    );

  // Pull every row that belongs to any note in this report. The presented-amount
  // map must be complete so callers can look up any row id without a fallback,
  // even when a row has no reclassifications.
  const notes = await db
    .select({ id: reportNotesTable.id })
    .from(reportNotesTable)
    .where(eq(reportNotesTable.reportId, reportId));
  const noteIds = notes.map((n) => n.id);
  const rows =
    noteIds.length === 0
      ? []
      : await db
          .select()
          .from(reportNoteRowsTable)
          .where(inArray(reportNoteRowsTable.noteId, noteIds));

  const inflows = new Map<string, number>();
  const outflows = new Map<string, number>();
  for (const r of reclasses) {
    const amt = toNum(r.amount) ?? 0;
    if (r.targetNoteRowId) {
      inflows.set(
        r.targetNoteRowId,
        (inflows.get(r.targetNoteRowId) ?? 0) + amt,
      );
    }
    if (r.sourceNoteRowId) {
      outflows.set(
        r.sourceNoteRowId,
        (outflows.get(r.sourceNoteRowId) ?? 0) + amt,
      );
    }
  }

  const result = new Map<string, PresentedNoteRowAmount>();
  for (const row of rows) {
    const mapped = toNum(row.currentYearAmount);
    const inflow = inflows.get(row.id) ?? 0;
    const outflow = outflows.get(row.id) ?? 0;
    const presented =
      mapped === null && inflow === 0 && outflow === 0
        ? null
        : (mapped ?? 0) + inflow - outflow;
    result.set(row.id, {
      rowId: row.id,
      noteId: row.noteId,
      mappedCurrentYearAmount: mapped !== null ? mapped.toFixed(2) : null,
      presentedCurrentYearAmount:
        presented !== null ? presented.toFixed(2) : null,
      inflowsCurrentYear: inflow.toFixed(2),
      outflowsCurrentYear: outflow.toFixed(2),
      hasReclassifications: inflow !== 0 || outflow !== 0,
    });
  }
  return result;
}

/**
 * Compute the presented amount for a single note row.
 * Returns null if the row has no mapped amount and no reclassifications.
 */
export async function getPresentedAmountForRow(
  rowId: string,
): Promise<PresentedNoteRowAmount | null> {
  const [row] = await db
    .select()
    .from(reportNoteRowsTable)
    .where(eq(reportNoteRowsTable.id, rowId))
    .limit(1);
  if (!row) return null;

  const reclasses = await db
    .select()
    .from(annualReportReclassificationsTable)
    .where(
      and(
        eq(annualReportReclassificationsTable.status, "active"),
        // No FK on report_id here — restrict by row references instead.
      ),
    );

  const mapped = toNum(row.currentYearAmount);
  let inflow = 0;
  let outflow = 0;
  for (const r of reclasses) {
    const amt = toNum(r.amount) ?? 0;
    if (r.targetNoteRowId === rowId) inflow += amt;
    if (r.sourceNoteRowId === rowId) outflow += amt;
  }
  const presented =
    mapped === null && inflow === 0 && outflow === 0
      ? null
      : (mapped ?? 0) + inflow - outflow;

  return {
    rowId: row.id,
    noteId: row.noteId,
    mappedCurrentYearAmount: mapped !== null ? mapped.toFixed(2) : null,
    presentedCurrentYearAmount:
      presented !== null ? presented.toFixed(2) : null,
    inflowsCurrentYear: inflow.toFixed(2),
    outflowsCurrentYear: outflow.toFixed(2),
    hasReclassifications: inflow !== 0 || outflow !== 0,
  };
}
