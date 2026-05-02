import { eq, asc, inArray, and } from "drizzle-orm";
import {
  db,
  reportNotesTable,
  noteStatementReferencesTable,
  financialStatementLinesTable,
} from "@workspace/db";

/**
 * Default ordering of note types for Swedish annual reports.
 * Redovisningsprinciper (accounting principles) is always first; the rest
 * follow the topical order used in the spec/framework rules.
 */
const DEFAULT_NOTE_TYPE_ORDER: string[] = [
  "accounting_principles",
  "revenue",
  "personnel",
  "depreciation",
  "intangible_assets",
  "tangible_assets",
  "financial_assets",
  "equity",
  "appropriations",
  "long_term_liabilities",
];

function defaultOrderFor(noteType: string): number {
  const idx = DEFAULT_NOTE_TYPE_ORDER.indexOf(noteType);
  return idx === -1 ? DEFAULT_NOTE_TYPE_ORDER.length + 100 : idx;
}

/**
 * Recalculate note_number for every note on a report.
 *
 * - Skips notes with status = "not_applicable" (they get note_number = NULL).
 * - Honors manual_number_override when set (1-based).
 * - Otherwise sorts by (sortOrder, defaultOrderFor(noteType), createdAt) and
 *   assigns sequential numbers 1..N.
 * - Updates note_statement_references.display_label to "Not <N>" so the
 *   financial-statement reference badges stay in sync.
 */
export async function recalculateNoteNumbers(
  reportId: string,
): Promise<{ renumbered: number; total: number }> {
  const allNotes = await db
    .select()
    .from(reportNotesTable)
    .where(eq(reportNotesTable.reportId, reportId))
    .orderBy(asc(reportNotesTable.sortOrder), asc(reportNotesTable.createdAt));

  const active = allNotes.filter((n) => n.status !== "not_applicable");
  const inactive = allNotes.filter((n) => n.status === "not_applicable");

  // Apply default ordering rules
  active.sort((a, b) => {
    if (a.manualNumberOverride && b.manualNumberOverride) {
      return a.manualNumberOverride - b.manualNumberOverride;
    }
    if (a.manualNumberOverride) return -1;
    if (b.manualNumberOverride) return 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const da = defaultOrderFor(a.noteType);
    const db_ = defaultOrderFor(b.noteType);
    if (da !== db_) return da - db_;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let assigned = 0;
  const updates: Array<Promise<unknown>> = [];

  active.forEach((note, idx) => {
    const newNumber = idx + 1;
    if (note.noteNumber !== newNumber) {
      updates.push(
        db
          .update(reportNotesTable)
          .set({ noteNumber: newNumber, updatedAt: new Date() })
          .where(eq(reportNotesTable.id, note.id)),
      );
      assigned++;
    }
  });

  // Clear note_number on inactive notes
  for (const n of inactive) {
    if (n.noteNumber !== null) {
      updates.push(
        db
          .update(reportNotesTable)
          .set({ noteNumber: null, updatedAt: new Date() })
          .where(eq(reportNotesTable.id, n.id)),
      );
      assigned++;
    }
  }

  if (updates.length > 0) await Promise.all(updates);

  // Sync display labels in note_statement_references
  // Build a map: noteId -> "Not <N>" or null
  const labelMap = new Map<string, string | null>();
  active.forEach((n, idx) => labelMap.set(n.id, `Not ${idx + 1}`));
  inactive.forEach((n) => labelMap.set(n.id, null));

  if (allNotes.length > 0) {
    const refs = await db
      .select()
      .from(noteStatementReferencesTable)
      .where(
        inArray(
          noteStatementReferencesTable.noteId,
          allNotes.map((n) => n.id),
        ),
      );

    const refUpdates = refs
      .filter((r) => labelMap.get(r.noteId) !== r.displayLabel)
      .map((r) =>
        db
          .update(noteStatementReferencesTable)
          .set({ displayLabel: labelMap.get(r.noteId) ?? null })
          .where(eq(noteStatementReferencesTable.id, r.id)),
      );

    if (refUpdates.length > 0) await Promise.all(refUpdates);

    // Sync the badge text on financial_statement_lines so the statements table
    // shows the new note numbers. We group refs by (statementType, lineKey) and
    // collect the active note numbers for each line.
    const noteNumberById = new Map<string, number>();
    active.forEach((n, idx) => noteNumberById.set(n.id, idx + 1));

    const linesByKey = new Map<string, number[]>();
    for (const r of refs) {
      const num = noteNumberById.get(r.noteId);
      if (!num) continue; // skip refs to inactive notes
      const key = `${r.statementType}::${r.lineKey}`;
      const arr = linesByKey.get(key) ?? [];
      arr.push(num);
      linesByKey.set(key, arr);
    }

    const reportId = allNotes[0].reportId;
    const lineUpdates: Array<Promise<unknown>> = [];
    for (const [key, nums] of linesByKey.entries()) {
      const [statementType, lineKey] = key.split("::");
      const sortedNums = [...new Set(nums)].sort((a, b) => a - b);
      const badgeText = sortedNums.join(", ");
      lineUpdates.push(
        db
          .update(financialStatementLinesTable)
          .set({ noteReferenceText: badgeText, updatedAt: new Date() })
          .where(
            and(
              eq(financialStatementLinesTable.reportId, reportId),
              eq(
                financialStatementLinesTable.statementType,
                statementType as "income_statement" | "balance_sheet" | "cash_flow",
              ),
              eq(financialStatementLinesTable.lineKey, lineKey),
            ),
          ),
      );
    }
    if (lineUpdates.length > 0) await Promise.all(lineUpdates);
  }

  return { renumbered: assigned, total: allNotes.length };
}
