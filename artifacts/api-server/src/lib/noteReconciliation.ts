import { eq, inArray } from "drizzle-orm";
import {
  db,
  reportNotesTable,
  reportNoteRowsTable,
  noteStatementReferencesTable,
  financialStatementLinesTable,
} from "@workspace/db";
import { getPresentedNoteRowAmounts } from "./presentationAmounts.js";

/**
 * noteReconciliation — verify that the totals shown in each note match the
 * totals on the underlying financial statement lines they're linked to.
 *
 * Reconciliation logic:
 *   noteTotal       = currentYearValue on the note (or sum of non-subtotal
 *                     row currentYearAmounts if rows exist)
 *   statementTotal  = sum of currentYearAmount on every statement line linked
 *                     to the note via note_statement_references
 *   difference      = |noteTotal - statementTotal|
 *
 * A tolerance of 1 SEK is applied to absorb rounding noise.
 *
 * Status:
 *   "ok"           — both sides agree within the tolerance
 *   "mismatch"     — both sides have amounts but they differ
 *   "missing_link" — note has a value but no statement line reference
 *   "no_amounts"   — neither side has any amount yet
 */

const TOLERANCE = 1;

export type ReconciliationStatus = "ok" | "mismatch" | "missing_link" | "no_amounts";

export interface ReconciliationItem {
  noteId: string;
  noteNumber: number | null;
  title: string;
  noteTotalCurrent: string | null;
  statementTotalCurrent: string | null;
  differenceCurrent: string | null;
  noteTotalPrevious: string | null;
  statementTotalPrevious: string | null;
  differencePrevious: string | null;
  status: ReconciliationStatus;
  linkedLineKeys: string[];
}

export interface ReconciliationResult {
  items: ReconciliationItem[];
  okCount: number;
  mismatchCount: number;
  missingLinkCount: number;
  noAmountsCount: number;
}

function toNum(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function diffString(a: number | null, b: number | null): string | null {
  if (a === null || b === null) return null;
  return (a - b).toFixed(2);
}

export async function reconcileNotes(reportId: string): Promise<ReconciliationResult> {
  const notes = await db
    .select()
    .from(reportNotesTable)
    .where(eq(reportNotesTable.reportId, reportId));

  if (notes.length === 0) {
    return {
      items: [],
      okCount: 0,
      mismatchCount: 0,
      missingLinkCount: 0,
      noAmountsCount: 0,
    };
  }

  const activeNotes = notes.filter((n) => n.status !== "not_applicable");
  const noteIds = activeNotes.map((n) => n.id);

  // Pull rows for active notes (used to derive note totals when the note has
  // a multi-row breakdown rather than a single currentYearValue).
  const rows = noteIds.length > 0
    ? await db
        .select()
        .from(reportNoteRowsTable)
        .where(inArray(reportNoteRowsTable.noteId, noteIds))
    : [];
  const rowsByNote = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = rowsByNote.get(r.noteId) ?? [];
    arr.push(r);
    rowsByNote.set(r.noteId, arr);
  }

  // Presented amounts (post-reclassification). Reconciliation must compare
  // the post-netting note totals against statement lines so that approved
  // reclassifications are reflected in the green/yellow/red status.
  const presented = await getPresentedNoteRowAmounts(reportId);

  // Pull all references for these notes
  const refs = noteIds.length > 0
    ? await db
        .select()
        .from(noteStatementReferencesTable)
        .where(inArray(noteStatementReferencesTable.noteId, noteIds))
    : [];
  const refsByNote = new Map<string, typeof refs>();
  for (const r of refs) {
    const arr = refsByNote.get(r.noteId) ?? [];
    arr.push(r);
    refsByNote.set(r.noteId, arr);
  }

  // Pull statement lines once for the report
  const lines = await db
    .select()
    .from(financialStatementLinesTable)
    .where(eq(financialStatementLinesTable.reportId, reportId));
  const lineByKey = new Map<string, typeof lines>();
  for (const l of lines) {
    const key = `${l.statementType}::${l.lineKey}`;
    const arr = lineByKey.get(key) ?? [];
    arr.push(l);
    lineByKey.set(key, arr);
  }

  const items: ReconciliationItem[] = [];

  for (const note of activeNotes) {
    const noteRows = rowsByNote.get(note.id) ?? [];
    const noteRefs = refsByNote.get(note.id) ?? [];

    // Derive note totals — prefer the sum of non-subtotal rows when rows exist.
    let noteTotalCurrent: number | null = null;
    let noteTotalPrevious: number | null = null;
    if (noteRows.length > 0) {
      const dataRows = noteRows.filter((r) => !r.isSubtotal);
      let cur: number | null = null;
      let prev: number | null = null;
      for (const r of dataRows) {
        // Use presented amount (mapped + reclass deltas) when available so
        // the reconciliation reflects what the user approved. Previous-year
        // amounts are not affected by reclassifications.
        const presentedRow = presented.get(r.id);
        const c =
          presentedRow !== undefined
            ? toNum(presentedRow.presentedCurrentYearAmount)
            : toNum(r.currentYearAmount);
        const p = toNum(r.previousYearAmount);
        if (c !== null) cur = (cur ?? 0) + c;
        if (p !== null) prev = (prev ?? 0) + p;
      }
      noteTotalCurrent = cur;
      noteTotalPrevious = prev;
    }
    if (noteTotalCurrent === null) noteTotalCurrent = toNum(note.currentYearValue);
    if (noteTotalPrevious === null) noteTotalPrevious = toNum(note.previousYearValue);

    // Sum the linked statement lines.
    let statementTotalCurrent: number | null = null;
    let statementTotalPrevious: number | null = null;
    for (const ref of noteRefs) {
      const key = `${ref.statementType}::${ref.lineKey}`;
      const matched = lineByKey.get(key) ?? [];
      for (const l of matched) {
        const c = toNum(l.currentYearAmount);
        const p = toNum(l.previousYearAmount);
        if (c !== null) statementTotalCurrent = (statementTotalCurrent ?? 0) + c;
        if (p !== null) statementTotalPrevious = (statementTotalPrevious ?? 0) + p;
      }
    }

    const linkedLineKeys = noteRefs.map((r) => `${r.statementType}:${r.lineKey}`);

    // Per-year status. We then collapse them into the single ReconciliationStatus
    // exposed on the item, but mismatches on either year flip the whole note
    // to "mismatch" — never silently green when the previous-year totals diverge.
    function classify(noteVal: number | null, stmtVal: number | null): "ok" | "mismatch" | "no_amounts" {
      if (noteVal === null && stmtVal === null) return "no_amounts";
      if (noteVal === null || stmtVal === null) return "mismatch";
      return Math.abs(noteVal - stmtVal) <= TOLERANCE ? "ok" : "mismatch";
    }

    let status: ReconciliationStatus;
    if (noteRefs.length === 0) {
      status = (noteTotalCurrent !== null || noteTotalPrevious !== null)
        ? "missing_link"
        : "no_amounts";
    } else {
      const cur = classify(noteTotalCurrent, statementTotalCurrent);
      const prev = classify(noteTotalPrevious, statementTotalPrevious);
      if (cur === "mismatch" || prev === "mismatch") {
        status = "mismatch";
      } else if (cur === "no_amounts" && prev === "no_amounts") {
        status = "no_amounts";
      } else {
        status = "ok";
      }
    }

    items.push({
      noteId: note.id,
      noteNumber: note.noteNumber,
      title: note.title,
      noteTotalCurrent: noteTotalCurrent !== null ? noteTotalCurrent.toFixed(2) : null,
      statementTotalCurrent:
        statementTotalCurrent !== null ? statementTotalCurrent.toFixed(2) : null,
      differenceCurrent: diffString(noteTotalCurrent, statementTotalCurrent),
      noteTotalPrevious:
        noteTotalPrevious !== null ? noteTotalPrevious.toFixed(2) : null,
      statementTotalPrevious:
        statementTotalPrevious !== null ? statementTotalPrevious.toFixed(2) : null,
      differencePrevious: diffString(noteTotalPrevious, statementTotalPrevious),
      status,
      linkedLineKeys,
    });
  }

  // Sort by note number (nulls last) then title
  items.sort((a, b) => {
    if (a.noteNumber === null && b.noteNumber !== null) return 1;
    if (a.noteNumber !== null && b.noteNumber === null) return -1;
    if (a.noteNumber !== b.noteNumber) {
      return (a.noteNumber ?? 0) - (b.noteNumber ?? 0);
    }
    return a.title.localeCompare(b.title);
  });

  return {
    items,
    okCount: items.filter((i) => i.status === "ok").length,
    mismatchCount: items.filter((i) => i.status === "mismatch").length,
    missingLinkCount: items.filter((i) => i.status === "missing_link").length,
    noAmountsCount: items.filter((i) => i.status === "no_amounts").length,
  };
}
