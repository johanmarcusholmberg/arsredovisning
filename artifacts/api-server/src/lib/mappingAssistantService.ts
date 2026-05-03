/**
 * mappingAssistantService — Phase 6.6.
 *
 * Rule-based assistant that returns *structured* per-account suggestions for
 * the account-mapping review step. Designed so an external AI provider can
 * later be slotted in without touching the route handlers, the UI, or the
 * audit log.
 *
 * Public shape (`MappingAssistantSuggestion`) is stable and serialised as-is
 * over the OpenAPI contract — see schemas/MappingAssistantSuggestion in
 * lib/api-spec/openapi.yaml.
 *
 * NEVER writes to financial data. Pure read.
 *
 * AI_HOOK markers below indicate where future LLM enrichment can be added.
 */

import { and, eq, ne } from "drizzle-orm";
import {
  db,
  accountMappingsTable,
  importBatchesTable,
  type AccountMapping,
} from "@workspace/db";
import { findRuleForAccount, listAllMappingRules } from "../helpers/autoMapper.js";

// ─── Public types ──────────────────────────────────────────────────────────────

export type AssistantConfidence = "low" | "medium" | "high";
export type AssistantSeverity = "info" | "warning" | "blocking";
export type AssistantRecommendedAction =
  | "keep"
  | "remap"
  | "net"
  | "review"
  | "manual_adjustment";

export type AssistantSource = "rules" | "ai";

export interface AssistantAlternativeRow {
  reportLine: string;
  reportLineLabel: string;
  reason: string;
}

export interface MappingAssistantSuggestion {
  accountId: string;
  accountNumber: string;
  accountName: string | null;
  currentRowId: string | null;
  currentRowLabel: string | null;
  suggestedRowId: string | null;
  suggestedRowLabel: string | null;
  confidence: AssistantConfidence;
  severity: AssistantSeverity;
  reason: string;
  explanation: string;
  recommendedAction: AssistantRecommendedAction;
  alternatives: AssistantAlternativeRow[];
  // High-risk findings flow into validationEngine to surface as warnings.
  isHighRisk: boolean;
  source: AssistantSource;
  expert: {
    basRange: string | null;
    basGroup: string | null;
    inferredSign: "debit" | "credit" | "either";
    rulePriority: number | null;
    expectedReportLine: string | null;
    notes: string[];
  };
}

// ─── BAS knowledge ────────────────────────────────────────────────────────────

/** Returns the leading numeric BAS account number, or null. */
function basNum(accountNumber: string): number | null {
  const m = accountNumber.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

function basGroup(num: number | null): string | null {
  if (num === null) return null;
  return String(num).slice(0, 2).padStart(2, "0");
}

/**
 * Heuristic side classification for a BAS account number:
 *   - 1xxx → assets / debit-natured
 *   - 2xxx → equity & liabilities / credit-natured
 *   - 3xxx → revenue / credit-natured
 *   - 4xxx-7xxx → costs / debit-natured
 *   - 8xxx → financial items, depends on subgroup
 */
function inferredSign(num: number | null): "debit" | "credit" | "either" {
  if (num === null) return "either";
  if (num >= 1000 && num <= 1999) return "debit";
  if (num >= 2000 && num <= 2999) return "credit";
  if (num >= 3000 && num <= 3999) return "credit";
  if (num >= 4000 && num <= 7999) return "debit";
  return "either";
}

/** True when the BAS group typically appears on both asset and liability side. */
function isMirrorProneGroup(group: string | null): boolean {
  if (!group) return false;
  // VAT (26), intercompany receivables/payables (15/24, 13/23), tax accounts (16/25)
  return ["13", "15", "16", "23", "24", "25", "26", "29"].includes(group);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface PartnerCandidate {
  mapping: AccountMapping;
  group: string | null;
  number: number | null;
}

/**
 * Look across the same batch for accounts whose BAS group is the
 * "mirror" of this one (e.g. a 1500-series customer receivable should
 * surface 2400-series supplier liabilities as net candidates).
 *
 * Pure rule-based — purely informational; the assistant only RECOMMENDS,
 * never re-classifies silently.
 */
function findMirrorCandidates(
  current: AccountMapping,
  batch: AccountMapping[],
): PartnerCandidate[] {
  const num = basNum(current.accountNumber);
  const group = basGroup(num);
  if (!group) return [];

  // Mirror map: which BAS groups commonly net against the current group.
  const MIRROR: Record<string, string[]> = {
    "13": ["23"],
    "15": ["24"],
    "16": ["25", "29"],
    "23": ["13"],
    "24": ["15"],
    "25": ["16"],
    "26": ["26"], // VAT in/out
    "29": ["16"],
  };

  const mirrors = MIRROR[group] ?? [];
  if (mirrors.length === 0) return [];

  return batch
    .filter((m) => m.id !== current.id)
    .map((m) => ({
      mapping: m,
      number: basNum(m.accountNumber),
      group: basGroup(basNum(m.accountNumber)),
    }))
    .filter((p) => p.group !== null && mirrors.includes(p.group));
}

// ─── Suggestion builder ───────────────────────────────────────────────────────

/**
 * Produce a structured suggestion for ONE mapping row.
 *
 * Inputs:
 *   - row: the current AccountMapping (already auto-mapped or overridden)
 *   - batch: the entire batch of mappings (for cross-account checks)
 *   - allRules: full active mapping_rules list (for "alternatives")
 */
async function buildSuggestionForRow(
  row: AccountMapping,
  batch: AccountMapping[],
): Promise<MappingAssistantSuggestion> {
  const num = basNum(row.accountNumber);
  const group = basGroup(num);
  const sign = inferredSign(num);

  const expectedRule = await findRuleForAccount(row.accountNumber);
  const allRules = await listAllMappingRules();

  // Alternative rows = other rules whose range OVERLAPS the same first
  // BAS digit (e.g. for a 1510 customer receivable, surface 1500-1699
  // siblings). Capped at 5 to keep the panel readable.
  const alternatives: AssistantAlternativeRow[] = [];
  if (num !== null) {
    const sameHundred = Math.floor(num / 1000) * 1000;
    const sameHundredEnd = sameHundred + 999;
    const seen = new Set<string>();
    for (const r of allRules) {
      if (r.reportLine === row.reportLine) continue;
      if (r.rangeEnd < sameHundred || r.rangeStart > sameHundredEnd) continue;
      if (seen.has(r.reportLine)) continue;
      seen.add(r.reportLine);
      alternatives.push({
        reportLine: r.reportLine,
        reportLineLabel: r.reportLineLabel,
        reason: `Närliggande BAS-intervall ${r.rangeStart}–${r.rangeEnd}.`,
      });
      if (alternatives.length >= 5) break;
    }
  }

  // ── Default: keep ─────────────────────────────────────────────────────────
  let confidence: AssistantConfidence =
    row.confidence === "unmapped" ? "low" : (row.confidence as AssistantConfidence);
  let severity: AssistantSeverity = "info";
  let action: AssistantRecommendedAction = "keep";
  let reason = "Mappningen ser rimlig ut utifrån BAS-kontoplanen.";
  let explanation =
    "Kontot har klassats enligt standardintervallet i BAS-kontoplanen och passar den föreslagna rapportraden. Inga avvikelser upptäckta.";
  let suggestedRowId = row.reportLine;
  let suggestedRowLabel = row.reportLineLabel;
  let isHighRisk = false;
  const expertNotes: string[] = [];

  // ── Unmapped / no BAS rule match ──────────────────────────────────────────
  if (!row.reportLine || row.confidence === "unmapped") {
    severity = "warning";
    action = "remap";
    reason = "Kontot är inte mappat mot någon rapportrad.";
    explanation =
      "Vi hittade ingen automatisk klassificering för det här kontonumret. " +
      "Välj manuellt vilken rad i resultat- eller balansräkningen kontot tillhör.";
    isHighRisk = true;
    if (expectedRule) {
      suggestedRowId = expectedRule.reportLine;
      suggestedRowLabel = expectedRule.reportLineLabel;
      reason = `BAS-intervall ${expectedRule.rangeStart}–${expectedRule.rangeEnd} föreslår "${expectedRule.reportLineLabel}".`;
    }
  }
  // ── Manual override that diverges from BAS expectation ────────────────────
  else if (
    row.isManualOverride &&
    expectedRule &&
    expectedRule.reportLine !== row.reportLine
  ) {
    severity = "warning";
    action = "review";
    confidence = "medium";
    reason =
      `Den manuella mappningen avviker från BAS-standarden för konto ${row.accountNumber}.`;
    explanation =
      `Standardregeln för BAS-intervall ${expectedRule.rangeStart}–${expectedRule.rangeEnd} pekar på ` +
      `"${expectedRule.reportLineLabel}", men kontot har manuellt flyttats till ` +
      `"${row.reportLineLabel}". Det är ofta korrekt vid kundspecifik kontoplan, ` +
      `men granska att det inte snedvrider rapportradens innebörd.`;
    suggestedRowId = expectedRule.reportLine;
    suggestedRowLabel = expectedRule.reportLineLabel;
  }
  // ── Low confidence auto-mapping ───────────────────────────────────────────
  else if (row.confidence === "low") {
    severity = "warning";
    action = "review";
    reason = "Låg konfidens — kontot kunde matchas mot flera möjliga rader.";
    explanation =
      "BAS-intervallet för det här kontot omfattar flera möjliga klassificeringar. " +
      "Bekräfta att den föreslagna raden stämmer med hur ni faktiskt använder kontot.";
    isHighRisk = true;
  }
  // ── Medium confidence — gentle nudge ──────────────────────────────────────
  else if (row.confidence === "medium") {
    severity = "info";
    action = "review";
    reason = "Medel konfidens — granska om kontoanvändningen är standard.";
    explanation =
      "Standardregeln matchade med medel säkerhet. Detta är vanligt för konton " +
      "som kan höra hemma på olika rader beroende på sammanhang (t.ex. finansiella poster).";
  }

  // ── Cross-account check: receivable/liability mirror with opposite sign ──
  // Only meaningful when the BAS group is mirror-prone (15/24, 13/23, 26/26, 16/29).
  // We can't see the actual numeric balance from the mapping row alone, so
  // we surface this as a NETTING candidate rather than a confirmed action —
  // the reclassificationEngine then runs at the note-row level for actual values.
  if (isMirrorProneGroup(group)) {
    const mirrors = findMirrorCandidates(row, batch);
    if (mirrors.length > 0) {
      // Upgrade severity if it was still info, but never demote.
      if (severity === "info") severity = "warning";
      if (action === "keep") action = "net";
      isHighRisk = true;
      const labels = mirrors
        .slice(0, 3)
        .map((m) => `${m.mapping.accountNumber} (${m.mapping.reportLineLabel ?? "okänd rad"})`)
        .join(", ");
      reason =
        `Konton i samma sak-grupp förekommer både på fordrings- och skuldsidan: ${labels}.`;
      explanation =
        "Det finns värden både på fordrings- och skuldsidan för denna grupp. " +
        "Systemet rekommenderar att beloppen nettas och presenteras på den sida " +
        "där nettot hör hemma. Granska beräkningen innan du tillämpar ändringen — " +
        "den faktiska nettningen sker i nästa steg när noterna räknas om.";
      expertNotes.push(
        `Mirror-kandidater i batch: ${mirrors.length}. Faktisk nettning beräknas av reclassificationEngine på radnivå.`,
      );
    }
  }

  // ── Sign sanity: mapped to an asset row but credit-natured (or vice versa) ──
  if (row.reportLine && sign !== "either") {
    const isAssetRow = /^BS_1\d{3}_/.test(row.reportLine);
    const isLiabilityRow = /^BS_2[0-9]{3}_/.test(row.reportLine);
    if (sign === "credit" && isAssetRow) {
      severity = "warning";
      action = "review";
      isHighRisk = true;
      expertNotes.push(
        "Sign-mismatch: kreditnaturat konto är mappat mot en tillgångsrad.",
      );
    } else if (sign === "debit" && isLiabilityRow) {
      severity = "warning";
      action = "review";
      isHighRisk = true;
      expertNotes.push(
        "Sign-mismatch: debetnaturat konto är mappat mot en skuldrad.",
      );
    }
  }

  // AI_HOOK: an external provider can refine `reason`, `explanation`, and
  // `confidence` here using the row, batch context, and expertNotes. It must
  // never silently change `suggestedRowId` without also updating `reason`.

  return {
    accountId: row.id,
    accountNumber: row.accountNumber,
    accountName: row.accountName,
    currentRowId: row.reportLine,
    currentRowLabel: row.reportLineLabel,
    suggestedRowId: suggestedRowId ?? null,
    suggestedRowLabel: suggestedRowLabel ?? null,
    confidence,
    severity,
    reason,
    explanation,
    recommendedAction: action,
    alternatives,
    isHighRisk,
    source: "rules",
    expert: {
      basRange: row.basRange,
      basGroup: group,
      inferredSign: sign,
      rulePriority: expectedRule?.priority ?? null,
      expectedReportLine: expectedRule?.reportLine ?? null,
      notes: expertNotes,
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a single assistant suggestion for one mapping row.
 * Loads the rest of the batch so cross-account checks (mirror groups) work.
 */
export async function getAssistantSuggestionForMapping(
  projectId: string,
  mappingId: string,
): Promise<MappingAssistantSuggestion | null> {
  const [row] = await db
    .select()
    .from(accountMappingsTable)
    .where(
      and(
        eq(accountMappingsTable.id, mappingId),
        eq(accountMappingsTable.projectId, projectId),
      ),
    )
    .limit(1);

  if (!row) return null;

  const batch = await db
    .select()
    .from(accountMappingsTable)
    .where(
      and(
        eq(accountMappingsTable.projectId, projectId),
        eq(accountMappingsTable.batchId, row.batchId),
        ne(accountMappingsTable.id, mappingId),
      ),
    );

  return buildSuggestionForRow(row, batch);
}

export interface AssistantScanResult {
  total: number;
  highRiskCount: number;
  warningCount: number;
  suggestions: MappingAssistantSuggestion[];
}

/**
 * Scan the entire active confirmed batch and return suggestions only for
 * rows where the assistant has something meaningful to say (severity !=
 * info OR recommendedAction != keep).
 *
 * Used by validationEngine to surface high-risk classification issues, and
 * by the mapping page to badge accounts that need attention.
 */
export async function scanMappingsForAssistance(
  projectId: string,
): Promise<AssistantScanResult> {
  const confirmed = await db
    .select({ id: importBatchesTable.id })
    .from(importBatchesTable)
    .where(
      and(
        eq(importBatchesTable.projectId, projectId),
        eq(importBatchesTable.status, "confirmed"),
      ),
    )
    .orderBy(importBatchesTable.confirmedAt)
    .limit(1);

  if (confirmed.length === 0) {
    return { total: 0, highRiskCount: 0, warningCount: 0, suggestions: [] };
  }

  const batchId = confirmed[0].id;

  const rows = await db
    .select()
    .from(accountMappingsTable)
    .where(
      and(
        eq(accountMappingsTable.projectId, projectId),
        eq(accountMappingsTable.batchId, batchId),
      ),
    );

  const suggestions: MappingAssistantSuggestion[] = [];
  for (const row of rows) {
    const s = await buildSuggestionForRow(
      row,
      rows.filter((r) => r.id !== row.id),
    );
    if (s.severity !== "info" || s.recommendedAction !== "keep") {
      suggestions.push(s);
    }
  }

  return {
    total: rows.length,
    highRiskCount: suggestions.filter((s) => s.isHighRisk).length,
    warningCount: suggestions.filter(
      (s) => s.severity === "warning" || s.severity === "blocking",
    ).length,
    suggestions,
  };
}
