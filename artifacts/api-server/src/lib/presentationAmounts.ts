import { and, eq, inArray, ne } from "drizzle-orm";
import {
  db,
  annualReportReclassificationsTable,
  reportNoteRowsTable,
  reportNotesTable,
  noteStatementReferencesTable,
} from "@workspace/db";

export interface RowAggregates {
  inflows: number;
  outflows: number;
}

/**
 * Effect-type semantics:
 *   - note_only            → adjusts the note presentation only.
 *   - report_node_only     → adjusts the financial-statement (BR/RR) line only.
 *   - note_and_report_node → adjusts BOTH.
 *
 * The note-row helpers below honour the first and the third; the report-node
 * helper below honours the second and the third. This keeps presentation
 * consistent with the user's intent at write time.
 */
const NOTE_AFFECTING_EFFECT_TYPES = [
  "note_only",
  "note_and_report_node",
] as const;
const REPORT_NODE_AFFECTING_EFFECT_TYPES = [
  "report_node_only",
  "note_and_report_node",
] as const;

/**
 * Compute the inflows/outflows aggregates per row id from active
 * reclassifications. Used both by the presented-amount calculation and by
 * the safeguards in routes/reclassifications when validating new entries.
 *
 * Only effect types that touch note rows are considered here — pure
 * report-node reclassifications never alter note-row capacity.
 */
export async function computeRowAggregates(
  reportId: string,
  opts: { excludeReclassId?: string } = {},
): Promise<Map<string, RowAggregates>> {
  const where = opts.excludeReclassId
    ? and(
        eq(annualReportReclassificationsTable.reportId, reportId),
        eq(annualReportReclassificationsTable.status, "active"),
        inArray(
          annualReportReclassificationsTable.effectType,
          [...NOTE_AFFECTING_EFFECT_TYPES],
        ),
        ne(annualReportReclassificationsTable.id, opts.excludeReclassId),
      )
    : and(
        eq(annualReportReclassificationsTable.reportId, reportId),
        eq(annualReportReclassificationsTable.status, "active"),
        inArray(
          annualReportReclassificationsTable.effectType,
          [...NOTE_AFFECTING_EFFECT_TYPES],
        ),
      );

  const reclasses = await db
    .select()
    .from(annualReportReclassificationsTable)
    .where(where);

  const map = new Map<string, RowAggregates>();
  function get(id: string): RowAggregates {
    let v = map.get(id);
    if (!v) {
      v = { inflows: 0, outflows: 0 };
      map.set(id, v);
    }
    return v;
  }
  for (const r of reclasses) {
    const amt = Math.abs(Number(r.amount));
    if (!Number.isFinite(amt)) continue;
    if (r.targetNoteRowId) get(r.targetNoteRowId).inflows += amt;
    if (r.sourceNoteRowId) get(r.sourceNoteRowId).outflows += amt;
  }
  return map;
}

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
  // Pull active reclassifications that touch note presentation. Pure
  // report-node reclassifications never affect note-row presented amounts.
  const reclasses = await db
    .select()
    .from(annualReportReclassificationsTable)
    .where(
      and(
        eq(annualReportReclassificationsTable.reportId, reportId),
        eq(annualReportReclassificationsTable.status, "active"),
        inArray(
          annualReportReclassificationsTable.effectType,
          [...NOTE_AFFECTING_EFFECT_TYPES],
        ),
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
        inArray(
          annualReportReclassificationsTable.effectType,
          [...NOTE_AFFECTING_EFFECT_TYPES],
        ),
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

// ─── Report-node (financial-statement line) presentation ────────────────────

export interface ReportNodeAdjustment {
  lineKey: string;
  inflowsCurrentYear: number;
  outflowsCurrentYear: number;
  netDelta: number;
}

/**
 * Compute the per-`lineKey` adjustment that active reclassifications apply
 * to financial-statement lines. Honours `report_node_only` and
 * `note_and_report_node` effect types only.
 *
 * Each reclassification's source note row → its note → linked statement
 * lines (via note_statement_references.lineKey) accrues an OUTFLOW; the
 * target's linked lines accrue an INFLOW. A reclass that flows between two
 * notes that map to the SAME statement line nets to zero on that line —
 * which is exactly what users expect from a between-notes reclassification
 * on a single BR/RR row.
 *
 * Returns a Map keyed by lineKey. Statement lines that no active reclass
 * touches are simply absent from the map (callers should treat absent as
 * "no adjustment").
 */
export async function getPresentedStatementLineAdjustments(
  reportId: string,
): Promise<Map<string, ReportNodeAdjustment>> {
  const reclasses = await db
    .select()
    .from(annualReportReclassificationsTable)
    .where(
      and(
        eq(annualReportReclassificationsTable.reportId, reportId),
        eq(annualReportReclassificationsTable.status, "active"),
        inArray(
          annualReportReclassificationsTable.effectType,
          [...REPORT_NODE_AFFECTING_EFFECT_TYPES],
        ),
      ),
    );
  if (reclasses.length === 0) return new Map();

  // Resolve note id for every involved row.
  const rowIds = new Set<string>();
  for (const r of reclasses) {
    if (r.sourceNoteRowId) rowIds.add(r.sourceNoteRowId);
    if (r.targetNoteRowId) rowIds.add(r.targetNoteRowId);
  }
  const rows =
    rowIds.size === 0
      ? []
      : await db
          .select({
            rowId: reportNoteRowsTable.id,
            noteId: reportNoteRowsTable.noteId,
          })
          .from(reportNoteRowsTable)
          .where(inArray(reportNoteRowsTable.id, [...rowIds]));
  const noteIdByRow = new Map(rows.map((r) => [r.rowId, r.noteId]));

  // Resolve linked statement-line keys per note.
  const noteIds = new Set(rows.map((r) => r.noteId));
  const refs =
    noteIds.size === 0
      ? []
      : await db
          .select({
            noteId: noteStatementReferencesTable.noteId,
            lineKey: noteStatementReferencesTable.lineKey,
          })
          .from(noteStatementReferencesTable)
          .where(
            inArray(noteStatementReferencesTable.noteId, [...noteIds]),
          );
  const lineKeysByNote = new Map<string, string[]>();
  for (const ref of refs) {
    const arr = lineKeysByNote.get(ref.noteId) ?? [];
    arr.push(ref.lineKey);
    lineKeysByNote.set(ref.noteId, arr);
  }

  function ensure(lineKey: string): ReportNodeAdjustment {
    let v = adjustments.get(lineKey);
    if (!v) {
      v = {
        lineKey,
        inflowsCurrentYear: 0,
        outflowsCurrentYear: 0,
        netDelta: 0,
      };
      adjustments.set(lineKey, v);
    }
    return v;
  }

  const adjustments = new Map<string, ReportNodeAdjustment>();
  for (const r of reclasses) {
    const amt = Math.abs(Number(r.amount));
    if (!Number.isFinite(amt) || amt === 0) continue;

    if (r.sourceNoteRowId) {
      const noteId = noteIdByRow.get(r.sourceNoteRowId);
      const keys = noteId ? lineKeysByNote.get(noteId) ?? [] : [];
      for (const k of keys) {
        const a = ensure(k);
        a.outflowsCurrentYear += amt;
        a.netDelta -= amt;
      }
    }
    if (r.targetNoteRowId) {
      const noteId = noteIdByRow.get(r.targetNoteRowId);
      const keys = noteId ? lineKeysByNote.get(noteId) ?? [] : [];
      for (const k of keys) {
        const a = ensure(k);
        a.inflowsCurrentYear += amt;
        a.netDelta += amt;
      }
    }
  }
  return adjustments;
}
