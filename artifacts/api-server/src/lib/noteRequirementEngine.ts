import { and, eq } from "drizzle-orm";
import {
  db,
  financialStatementLinesTable,
  reportNotesTable,
  noteStatementReferencesTable,
  type ReportNote,
} from "@workspace/db";
import { getFrameworkRules, type NoteRequirement } from "./frameworkRules.js";

export interface SuggestedNote {
  noteType: string;
  title: string;
  framework: "K2" | "K3";
  requirementLevel: "required" | "likely_required" | "optional";
  sourceTrigger: string;
  linkedStatementLines: { lineKey: string; statementType: string; label: string }[];
  currentYearValue: string | null;
  previousYearValue: string | null;
}

interface LineSummary {
  id: string;
  lineKey: string;
  statementType: string;
  swedishLabel: string;
  currentYearAmount: string | null;
  previousYearAmount: string | null;
}

/**
 * Run the note requirement engine for a report.
 *
 * For each NoteRequirement defined in the framework rules:
 *   - Find statement lines whose lineKey matches the rule's lineKeys
 *   - If any of those lines have a non-zero current or previous year value,
 *     promote the requirement level to "likely_required" (unless rule.required
 *     is already true → "required").
 *   - If rule.required is true → always emit ("required").
 *   - Otherwise emit if any linked line exists → "optional" or "likely_required"
 *     depending on values.
 *
 * The accounting_principles note (no lineKeys, required = true) is always
 * emitted first.
 */
export function buildSuggestions(
  framework: "K2" | "K3",
  lines: LineSummary[],
): SuggestedNote[] {
  const rules = getFrameworkRules(framework);
  const linesByKey = new Map<string, LineSummary>();
  for (const l of lines) linesByKey.set(l.lineKey, l);

  const out: SuggestedNote[] = [];
  for (const req of rules.noteRequirements) {
    const linked = req.lineKeys
      .map((k) => linesByKey.get(k))
      .filter((l): l is LineSummary => Boolean(l));

    if (req.lineKeys.length > 0 && linked.length === 0 && !req.required) {
      // No matching lines → skip optional notes
      continue;
    }

    const hasNonZeroValue = linked.some(
      (l) =>
        (l.currentYearAmount && l.currentYearAmount !== "0") ||
        (l.previousYearAmount && l.previousYearAmount !== "0"),
    );

    let level: SuggestedNote["requirementLevel"] = "optional";
    if (req.required) level = "required";
    else if (hasNonZeroValue) level = "likely_required";

    const trigger = buildTrigger(req, linked, hasNonZeroValue);

    const sumCurrent = sumNumeric(linked.map((l) => l.currentYearAmount));
    const sumPrev = sumNumeric(linked.map((l) => l.previousYearAmount));

    out.push({
      noteType: req.noteType,
      title: req.swedishLabel,
      framework,
      requirementLevel: level,
      sourceTrigger: trigger,
      linkedStatementLines: linked.map((l) => ({
        lineKey: l.lineKey,
        statementType: l.statementType,
        label: l.swedishLabel,
      })),
      currentYearValue: sumCurrent,
      previousYearValue: sumPrev,
    });
  }
  return out;
}

function buildTrigger(
  req: NoteRequirement,
  linked: LineSummary[],
  hasValue: boolean,
): string {
  if (req.required && req.lineKeys.length === 0) {
    return `Krävs alltid enligt ramverket (${req.swedishLabel}).`;
  }
  if (req.required) {
    return `Krävs av ramverket. Kopplad till ${linked.length} rad(er).`;
  }
  if (hasValue) {
    return `Föreslås eftersom kopplade rader har värden (${linked.length} rad(er)).`;
  }
  return `Valfri not kopplad till ${linked.length} rad(er).`;
}

function sumNumeric(values: (string | null)[]): string | null {
  const nums = values
    .filter((v): v is string => v !== null && v !== "")
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n));
  if (nums.length === 0) return null;
  const total = nums.reduce((a, b) => a + b, 0);
  return total.toFixed(2);
}

/**
 * Idempotent upsert of suggestions for a report. Existing notes (by noteType)
 * are preserved unless they are still in "not_started" or "suggested" status,
 * in which case their values, requirementLevel and linkedStatementLines are
 * refreshed.
 *
 * Returns the count of notes created and updated.
 */
export async function suggestNotesForReport(
  reportId: string,
  framework: "K2" | "K3",
): Promise<{ created: number; updated: number; suggestions: SuggestedNote[] }> {
  const lines = await db
    .select({
      id: financialStatementLinesTable.id,
      lineKey: financialStatementLinesTable.lineKey,
      statementType: financialStatementLinesTable.statementType,
      swedishLabel: financialStatementLinesTable.swedishLabel,
      currentYearAmount: financialStatementLinesTable.currentYearAmount,
      previousYearAmount: financialStatementLinesTable.previousYearAmount,
    })
    .from(financialStatementLinesTable)
    .where(eq(financialStatementLinesTable.reportId, reportId));

  const suggestions = buildSuggestions(framework, lines);

  const existing = await db
    .select()
    .from(reportNotesTable)
    .where(eq(reportNotesTable.reportId, reportId));
  const existingByType = new Map<string, ReportNote>();
  for (const n of existing) existingByType.set(n.noteType, n);

  let created = 0;
  let updated = 0;

  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    const prior = existingByType.get(s.noteType);
    if (!prior) {
      const [inserted] = await db
        .insert(reportNotesTable)
        .values({
          reportId,
          noteType: s.noteType,
          title: s.title,
          requirementLevel: s.requirementLevel,
          status: "suggested",
          framework: s.framework,
          sourceTrigger: s.sourceTrigger,
          linkedStatementLines: s.linkedStatementLines,
          currentYearValue: s.currentYearValue,
          previousYearValue: s.previousYearValue,
          sortOrder: i,
        })
        .returning();
      created++;
      // Insert join rows
      if (s.linkedStatementLines.length > 0) {
        await db.insert(noteStatementReferencesTable).values(
          s.linkedStatementLines.map((l) => ({
            noteId: inserted.id,
            statementType: l.statementType as
              | "income_statement"
              | "balance_sheet"
              | "cash_flow",
            lineKey: l.lineKey,
            displayLabel: null,
          })),
        );
      }
    } else if (prior.status === "not_started" || prior.status === "suggested") {
      // Refresh
      await db
        .update(reportNotesTable)
        .set({
          requirementLevel: s.requirementLevel,
          sourceTrigger: s.sourceTrigger,
          linkedStatementLines: s.linkedStatementLines,
          currentYearValue: s.currentYearValue,
          previousYearValue: s.previousYearValue,
          updatedAt: new Date(),
        })
        .where(eq(reportNotesTable.id, prior.id));

      // Replace join rows
      await db
        .delete(noteStatementReferencesTable)
        .where(eq(noteStatementReferencesTable.noteId, prior.id));
      if (s.linkedStatementLines.length > 0) {
        await db.insert(noteStatementReferencesTable).values(
          s.linkedStatementLines.map((l) => ({
            noteId: prior.id,
            statementType: l.statementType as
              | "income_statement"
              | "balance_sheet"
              | "cash_flow",
            lineKey: l.lineKey,
            displayLabel: null,
          })),
        );
      }
      updated++;
    }
  }

  return { created, updated, suggestions };
}
