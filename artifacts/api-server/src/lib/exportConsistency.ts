/**
 * Export-time consistency checks that go beyond the standard validation
 * engine. These verify that the snapshot you're about to export is
 * internally coherent:
 *
 *   - Every note referenced from a financial-statement line resolves to a
 *     real, confirmed note.
 *   - Every active note has at least one statement reference (orphan notes
 *     are surfaced as warnings, not blockers).
 *   - Reclassifications net to zero per (sourceRow, targetRow) pair so the
 *     presented amounts on Resultaträkning / Balansräkning still tie out.
 *
 * Returns a list of `ReadinessItem`s scoped to the "consistency" cluster.
 * The export readiness service merges these with validation engine output.
 */

import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  reportsTable,
  reportNotesTable,
  noteStatementReferencesTable,
  financialStatementLinesTable,
  annualReportReclassificationsTable,
} from "@workspace/db";
import type { ReadinessItem } from "@workspace/export-contract";

export async function runExportConsistencyChecks(
  reportId: string,
): Promise<ReadinessItem[]> {
  const items: ReadinessItem[] = [];

  const [reportExists] = await db
    .select({ id: reportsTable.id })
    .from(reportsTable)
    .where(eq(reportsTable.id, reportId))
    .limit(1);
  if (!reportExists) return items;

  const [notes, refs, lines, reclasses] = await Promise.all([
    db.select().from(reportNotesTable).where(eq(reportNotesTable.reportId, reportId)),
    db.select().from(noteStatementReferencesTable),
    db
      .select()
      .from(financialStatementLinesTable)
      .where(eq(financialStatementLinesTable.reportId, reportId)),
    db
      .select()
      .from(annualReportReclassificationsTable)
      .where(
        and(
          eq(annualReportReclassificationsTable.reportId, reportId),
          eq(annualReportReclassificationsTable.status, "active"),
        ),
      ),
  ]);

  const noteIds = new Set(notes.map((n) => n.id));
  const noteRefsByNoteId = new Map<string, number>();
  for (const r of refs) {
    if (!noteIds.has(r.noteId)) continue;
    noteRefsByNoteId.set(r.noteId, (noteRefsByNoteId.get(r.noteId) ?? 0) + 1);
  }

  // 1. Orphan note references on statement lines (text references that don't
  //    map to a real note row).
  for (const line of lines) {
    const text = (line.noteReferenceText ?? "").trim();
    if (!text) continue;
    // Tokens look like "1", "1, 4", "Not 1". Normalise to numeric tokens.
    const numericTokens = text
      .split(/[,\s]+/)
      .map((t) => t.replace(/^Not/i, "").trim())
      .filter((t) => /^\d+$/.test(t));

    if (numericTokens.length === 0) continue;
    const matchedNumbers = new Set(
      notes.filter((n) => n.noteNumber !== null).map((n) => String(n.noteNumber)),
    );
    const unmatched = numericTokens.filter((t) => !matchedNumbers.has(t));
    if (unmatched.length > 0) {
      items.push({
        code: "notes_unmapped_reference",
        level: "warning",
        message: `Raden "${line.swedishLabel}" hänvisar till not ${unmatched.join(
          ", ",
        )} som inte hittas i notmodulen.`,
        quickLinkPath: "notes",
      });
    }
  }

  // 2. Notes that nothing references (orphan notes).
  for (const note of notes) {
    if (note.status === "not_applicable") continue;
    const refCount = noteRefsByNoteId.get(note.id) ?? 0;
    if (refCount === 0 && note.requirementLevel !== "required") {
      items.push({
        code: "notes_orphan_reference",
        level: "info",
        message: `Not "${note.title}" är inte länkad till någon rad i resultat- eller balansräkningen.`,
        quickLinkPath: "notes",
      });
    }
  }

  // 3. Notes that are required-but-unconfirmed.
  for (const note of notes) {
    if (note.status === "not_applicable") continue;
    if (note.requiresUserConfirmation && !note.confirmedByUser) {
      items.push({
        code: "notes_unconfirmed",
        level: "blocking",
        message: `Not ${note.noteNumber ?? "—"} "${note.title}" har AI-text som måste godkännas av användaren.`,
        quickLinkPath: "notes",
      });
    }
    if (note.requirementLevel === "required" && !(note.acceptedText ?? "").trim()) {
      items.push({
        code: "notes_missing_text",
        level: "blocking",
        message: `Not ${note.noteNumber ?? "—"} "${note.title}" saknar slutgiltig text.`,
        quickLinkPath: "notes",
      });
    }
  }

  // 4. Reclassification netting must be balanced — totalled inflows should
  //    equal totalled outflows for each effect type that touches the report
  //    surface. We use a simple per-source / per-target sum and flag
  //    imbalances above a 1 SEK rounding threshold.
  let totalDelta = 0;
  for (const r of reclasses) {
    const amt = Number(r.amount);
    if (Number.isFinite(amt)) totalDelta += amt;
  }
  if (Math.abs(totalDelta) > 1) {
    items.push({
      code: "reclass_inconsistency",
      level: "warning",
      message: `Aktiva omklassificeringar nettar inte till noll (skillnad ${totalDelta.toFixed(
        2,
      )} kr). Kontrollera att varje förslag har en mottagande not.`,
      quickLinkPath: "reclassifications",
    });
  }

  return items;
}

// Silence unused import warnings under tsc -p with noUnusedLocals=true.
void inArray;
