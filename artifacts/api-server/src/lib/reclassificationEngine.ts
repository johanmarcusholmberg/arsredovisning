import { eq, inArray } from "drizzle-orm";
import {
  db,
  reportNotesTable,
  reportNoteRowsTable,
  annualReportReclassificationSuggestionsTable,
  type AnnualReportReclassificationSuggestion,
  type ReportNoteRow,
} from "@workspace/db";

/**
 * Reclassification engine — Phase 6.5.
 *
 * Rule-based detection of cases where amounts spread across two notes (or
 * two rows in the same note) likely refer to the same underlying item and
 * should be presented netted, e.g.:
 *   - A receivable + a payable on the same counterparty account.
 *   - Mirrored debit / credit balances on related BAS accounts.
 *   - Intercompany pairs across "Fordringar koncernföretag" /
 *     "Skulder koncernföretag".
 *   - Same VAT/tax category on both sides.
 *
 * The engine is PURE rule-based for Phase 6.5. AI enrichment hook points
 * are clearly marked with `AI_HOOK:` comments below — see Phase 7+.
 *
 * Output: a list of suggestion candidates with a confidence level and a
 * plain-Swedish explanation. They are persisted into
 * annual_report_reclassification_suggestions; nothing in this engine writes
 * to financial data.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DetectionInput {
  reportId: string;
}

export interface SuggestionCandidate {
  reportId: string;
  sourceNoteRowId: string | null;
  targetNoteRowId: string | null;
  sourceLabel: string | null;
  targetLabel: string | null;
  sourceAccountNumber: string | null;
  targetAccountNumber: string | null;
  suggestedAmount: string;
  confidenceLevel: "high" | "medium" | "low";
  ruleKey: string;
  explanation: string;
  detailJson: Record<string, unknown> | null;
  effectType: "note_only" | "report_node_only" | "note_and_report_node";
}

export interface DetectionResult {
  candidates: SuggestionCandidate[];
  inserted: number;
  skippedAsDuplicates: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtAmount(n: number): string {
  return n.toFixed(2);
}

/**
 * Extract the leading BAS account number (e.g. "1510") from a row's source
 * metadata so rule matching can compare account ranges. Returns the lowest
 * account number found in either sourceAccountIds or sourceAccountRanges,
 * or null if no account is referenced.
 */
function firstAccountNumber(row: ReportNoteRow): string | null {
  const ids = (row.sourceAccountIds ?? null) as unknown as
    | string[]
    | number[]
    | null;
  if (Array.isArray(ids) && ids.length > 0) {
    const sorted = [...ids].map((x) => String(x)).sort();
    return sorted[0];
  }
  const ranges = (row.sourceAccountRanges ?? null) as unknown as
    | Array<{ from?: string | number; to?: string | number }>
    | null;
  if (Array.isArray(ranges) && ranges.length > 0 && ranges[0].from !== undefined) {
    return String(ranges[0].from);
  }
  return null;
}

/**
 * BAS account "first 2 digits" range used for grouping rule matches:
 *   "15" — Kundfordringar
 *   "16" — Övriga kortfristiga fordringar
 *   "24" — Skulder koncernföretag
 *   "26" — Moms
 *   etc.
 */
function basGroup(accountNumber: string | null): string | null {
  if (!accountNumber) return null;
  const digits = accountNumber.replace(/\D/g, "");
  return digits.length >= 2 ? digits.slice(0, 2) : null;
}

/** True when the two BAS groups commonly net against each other. */
function isCommonOffsetPair(a: string, b: string): boolean {
  const PAIRS: Array<[string, string]> = [
    ["15", "24"], // Kundfordringar / Skulder koncernföretag (intercompany)
    ["16", "29"], // Övriga fordringar / Övriga skulder
    ["26", "26"], // Moms (in/ut), same group
    ["13", "23"], // Långfristiga fordringar / Långfristiga skulder
  ];
  return PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Scan all note rows in the report and emit suggestion candidates.
 *
 * Rules implemented (all rule-based — no AI):
 *
 *   R1  opposite_signs_same_account
 *       Two rows with sourceAccountIds containing the same account number
 *       and opposite signs → high confidence "net these against each other".
 *
 *   R2  opposite_signs_offset_pair
 *       Two rows in commonly-offset BAS groups (e.g. 15 vs 24) with opposite
 *       signs and amounts within 5% of each other → medium confidence.
 *
 *   R3  similar_amount_intercompany
 *       Two rows whose label contains "koncern" or "närstående" with
 *       opposite signs and matching absolute amounts → medium.
 *
 *   R4  vat_inout_same_period
 *       Two rows in BAS group 26 (moms) with opposite signs → low confidence
 *       reminder to net VAT in/out before presenting.
 *
 * AI_HOOK: Future versions can call an LLM with the row metadata to surface
 *           additional candidates (e.g. similar memo text, currency hedging
 *           pairs). Add new rules here and tag them with confidence "low"
 *           by default so users keep their final say.
 */
export async function detectReclassificationCandidates(
  input: DetectionInput,
): Promise<SuggestionCandidate[]> {
  const { reportId } = input;

  const notes = await db
    .select()
    .from(reportNotesTable)
    .where(eq(reportNotesTable.reportId, reportId));
  const activeNotes = notes.filter((n) => n.status !== "not_applicable");
  const noteIds = activeNotes.map((n) => n.id);
  if (noteIds.length === 0) return [];

  const rows = await db
    .select()
    .from(reportNoteRowsTable)
    .where(inArray(reportNoteRowsTable.noteId, noteIds));

  const dataRows = rows.filter((r) => !r.isSubtotal);
  const noteById = new Map(activeNotes.map((n) => [n.id, n] as const));

  const candidates: SuggestionCandidate[] = [];

  // Pre-index rows by first account number for R1 / R2 lookups.
  const rowsByAccount = new Map<string, typeof dataRows>();
  for (const r of dataRows) {
    const acct = firstAccountNumber(r);
    if (!acct) continue;
    const arr = rowsByAccount.get(acct) ?? [];
    arr.push(r);
    rowsByAccount.set(acct, arr);
  }

  // R1: opposite signs on same account number.
  for (const [acct, group] of rowsByAccount) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (a.noteId === b.noteId) continue;
        const av = toNum(a.currentYearAmount);
        const bv = toNum(b.currentYearAmount);
        if (av === null || bv === null) continue;
        if (Math.sign(av) === Math.sign(bv)) continue;
        if (av === 0 || bv === 0) continue;
        const netAmount = Math.min(Math.abs(av), Math.abs(bv));
        const noteA = noteById.get(a.noteId);
        const noteB = noteById.get(b.noteId);
        candidates.push({
          reportId,
          sourceNoteRowId: a.id,
          targetNoteRowId: b.id,
          sourceLabel: noteA ? `${noteA.title}: ${a.label}` : a.label,
          targetLabel: noteB ? `${noteB.title}: ${b.label}` : b.label,
          sourceAccountNumber: acct,
          targetAccountNumber: acct,
          suggestedAmount: fmtAmount(netAmount),
          confidenceLevel: "high",
          ruleKey: "opposite_signs_same_account",
          explanation:
            `Konto ${acct} förekommer både som fordran och skuld i två noter. ` +
            `Det är vanligt att posterna avser samma motpart och bör nettas innan presentation.`,
          detailJson: {
            rule: "opposite_signs_same_account",
            account: acct,
            sourceAmount: av,
            targetAmount: bv,
          },
          effectType: "note_only",
        });
      }
    }
  }

  // R2: offset BAS-group pair with opposite signs and similar amounts.
  for (let i = 0; i < dataRows.length; i++) {
    for (let j = i + 1; j < dataRows.length; j++) {
      const a = dataRows[i];
      const b = dataRows[j];
      if (a.noteId === b.noteId) continue;
      const acctA = firstAccountNumber(a);
      const acctB = firstAccountNumber(b);
      if (!acctA || !acctB || acctA === acctB) continue;
      const groupA = basGroup(acctA);
      const groupB = basGroup(acctB);
      if (!groupA || !groupB) continue;
      if (!isCommonOffsetPair(groupA, groupB)) continue;
      const av = toNum(a.currentYearAmount);
      const bv = toNum(b.currentYearAmount);
      if (av === null || bv === null || av === 0 || bv === 0) continue;
      if (Math.sign(av) === Math.sign(bv)) continue;
      const ratio =
        Math.min(Math.abs(av), Math.abs(bv)) /
        Math.max(Math.abs(av), Math.abs(bv));
      if (ratio < 0.95) continue;
      const noteA = noteById.get(a.noteId);
      const noteB = noteById.get(b.noteId);
      candidates.push({
        reportId,
        sourceNoteRowId: a.id,
        targetNoteRowId: b.id,
        sourceLabel: noteA ? `${noteA.title}: ${a.label}` : a.label,
        targetLabel: noteB ? `${noteB.title}: ${b.label}` : b.label,
        sourceAccountNumber: acctA,
        targetAccountNumber: acctB,
        suggestedAmount: fmtAmount(Math.min(Math.abs(av), Math.abs(bv))),
        confidenceLevel: "medium",
        ruleKey: "opposite_signs_offset_pair",
        explanation:
          `Konton ${acctA} och ${acctB} brukar avse samma underliggande post ` +
          `och har här motsatta tecken med nästan samma belopp. Överväg nettning.`,
        detailJson: {
          rule: "opposite_signs_offset_pair",
          accountSource: acctA,
          accountTarget: acctB,
          sourceAmount: av,
          targetAmount: bv,
          similarityRatio: ratio,
        },
        effectType: "note_only",
      });
    }
  }

  // R3: intercompany pair (label contains "koncern" or "närstående").
  const ICRE = /(koncern|närstå)/i;
  const icRows = dataRows.filter((r) => ICRE.test(r.label));
  for (let i = 0; i < icRows.length; i++) {
    for (let j = i + 1; j < icRows.length; j++) {
      const a = icRows[i];
      const b = icRows[j];
      if (a.noteId === b.noteId) continue;
      const av = toNum(a.currentYearAmount);
      const bv = toNum(b.currentYearAmount);
      if (av === null || bv === null) continue;
      if (Math.sign(av) === Math.sign(bv)) continue;
      if (Math.abs(Math.abs(av) - Math.abs(bv)) > 1) continue;
      const noteA = noteById.get(a.noteId);
      const noteB = noteById.get(b.noteId);
      candidates.push({
        reportId,
        sourceNoteRowId: a.id,
        targetNoteRowId: b.id,
        sourceLabel: noteA ? `${noteA.title}: ${a.label}` : a.label,
        targetLabel: noteB ? `${noteB.title}: ${b.label}` : b.label,
        sourceAccountNumber: firstAccountNumber(a),
        targetAccountNumber: firstAccountNumber(b),
        suggestedAmount: fmtAmount(Math.min(Math.abs(av), Math.abs(bv))),
        confidenceLevel: "medium",
        ruleKey: "similar_amount_intercompany",
        explanation:
          `Två koncerninterna poster har samma belopp men motsatta tecken. ` +
          `Det tyder på en spegelvänd intern fordran/skuld som kan behöva nettas.`,
        detailJson: {
          rule: "similar_amount_intercompany",
          sourceAmount: av,
          targetAmount: bv,
        },
        effectType: "note_only",
      });
    }
  }

  // R4: VAT in/out reminder.
  const vatRows = dataRows.filter((r) => basGroup(firstAccountNumber(r)) === "26");
  for (let i = 0; i < vatRows.length; i++) {
    for (let j = i + 1; j < vatRows.length; j++) {
      const a = vatRows[i];
      const b = vatRows[j];
      if (a.noteId === b.noteId) continue;
      const av = toNum(a.currentYearAmount);
      const bv = toNum(b.currentYearAmount);
      if (av === null || bv === null || av === 0 || bv === 0) continue;
      if (Math.sign(av) === Math.sign(bv)) continue;
      const noteA = noteById.get(a.noteId);
      const noteB = noteById.get(b.noteId);
      candidates.push({
        reportId,
        sourceNoteRowId: a.id,
        targetNoteRowId: b.id,
        sourceLabel: noteA ? `${noteA.title}: ${a.label}` : a.label,
        targetLabel: noteB ? `${noteB.title}: ${b.label}` : b.label,
        sourceAccountNumber: firstAccountNumber(a),
        targetAccountNumber: firstAccountNumber(b),
        suggestedAmount: fmtAmount(Math.min(Math.abs(av), Math.abs(bv))),
        confidenceLevel: "low",
        ruleKey: "vat_inout_same_period",
        explanation:
          `In- och utgående moms ligger i två noter med motsatta tecken. ` +
          `Kontrollera om de bör nettas till en momsfordran eller momsskuld.`,
        detailJson: {
          rule: "vat_inout_same_period",
          sourceAmount: av,
          targetAmount: bv,
        },
        effectType: "note_only",
      });
    }
  }

  // AI_HOOK: insert AI-generated candidates here. Append to `candidates`
  // with confidence "low" by default. Engine output is otherwise unchanged.

  return candidates;
}

/**
 * Persist new candidates into the suggestions table. Existing suggestions
 * with the same (reportId, ruleKey, sourceNoteRowId, targetNoteRowId) are
 * NOT duplicated — the row is left as-is so user-applied status is preserved.
 *
 * Returns counts so callers can surface "X new suggestions" in the UI.
 */
export async function persistSuggestionCandidates(
  reportId: string,
  candidates: SuggestionCandidate[],
): Promise<DetectionResult> {
  if (candidates.length === 0) {
    return { candidates: [], inserted: 0, skippedAsDuplicates: 0 };
  }

  const existing = await db
    .select()
    .from(annualReportReclassificationSuggestionsTable)
    .where(
      eq(annualReportReclassificationSuggestionsTable.reportId, reportId),
    );

  const existingKey = (
    s: Pick<
      AnnualReportReclassificationSuggestion,
      "ruleKey" | "sourceNoteRowId" | "targetNoteRowId"
    >,
  ) => `${s.ruleKey}::${s.sourceNoteRowId ?? ""}::${s.targetNoteRowId ?? ""}`;

  const existingKeys = new Set(existing.map((e) => existingKey(e)));

  const fresh = candidates.filter(
    (c) =>
      !existingKeys.has(
        existingKey({
          ruleKey: c.ruleKey,
          sourceNoteRowId: c.sourceNoteRowId,
          targetNoteRowId: c.targetNoteRowId,
        }),
      ),
  );

  let inserted = 0;
  if (fresh.length > 0) {
    const rows = await db
      .insert(annualReportReclassificationSuggestionsTable)
      .values(
        fresh.map((c) => ({
          reportId: c.reportId,
          sourceNoteRowId: c.sourceNoteRowId,
          targetNoteRowId: c.targetNoteRowId,
          sourceLabel: c.sourceLabel,
          targetLabel: c.targetLabel,
          sourceAccountNumber: c.sourceAccountNumber,
          targetAccountNumber: c.targetAccountNumber,
          suggestedAmount: c.suggestedAmount,
          confidenceLevel: c.confidenceLevel,
          ruleKey: c.ruleKey,
          explanation: c.explanation,
          detailJson: c.detailJson ?? null,
          effectType: c.effectType,
          status: "suggested" as const,
        })),
      )
      .returning();
    inserted = rows.length;
  }

  return {
    candidates,
    inserted,
    skippedAsDuplicates: candidates.length - fresh.length,
  };
}

/**
 * Convenience wrapper: detect + persist in a single call.
 */
export async function runReclassificationDetection(
  reportId: string,
): Promise<DetectionResult> {
  const candidates = await detectReclassificationCandidates({ reportId });
  return persistSuggestionCandidates(reportId, candidates);
}
