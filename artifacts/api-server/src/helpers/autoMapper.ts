/**
 * Auto-mapping engine — server-side only.
 *
 * Maps BAS account numbers to K2/K3 report lines using rules loaded from the
 * `mapping_rules` table. Rules are cached in-process for performance; call
 * `reloadMappingRules()` after admin updates to invalidate the cache.
 *
 * If the DB table is empty (e.g. a fresh environment where the seed script has
 * not been run), the engine falls back to a small bootstrap rule set so the
 * application keeps working — but a warning is logged so operators notice.
 *
 * Each account gets:
 *   - reportLine: a key identifying the balance sheet / income statement position
 *   - reportLineLabel: Swedish human-readable label
 *   - confidence: "high" | "medium" | "low" | "unmapped"
 *   - noteImpactFlag: true if the account type implies a mandatory note
 *   - noteType: which note type is implicated (e.g. "fixed_assets", "personnel")
 */

import { eq } from "drizzle-orm";
import { db, mappingRulesTable } from "@workspace/db";
import { logger } from "../lib/logger.js";

export interface MappingRuleDefinition {
  rangeStart: number;
  rangeEnd: number;
  reportLine: string;
  reportLineLabel: string;
  confidence: "high" | "medium" | "low";
  noteImpactFlag: boolean;
  noteType?: string;
  priority: number;
}

export interface AutoMappingResult {
  accountNumber: string;
  accountName: string | null;
  reportLine: string | null;
  reportLineLabel: string | null;
  basRange: string | null;
  confidence: "high" | "medium" | "low" | "unmapped";
  noteImpactFlag: boolean;
  noteImpactMetadata: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Bootstrap fallback rules
//
// Used only when the mapping_rules table is empty. The canonical source of
// truth lives in the DB; keep this list short and call out the fallback in
// logs so operators run the seed script.
// ---------------------------------------------------------------------------

const BOOTSTRAP_RULES: MappingRuleDefinition[] = [
  { rangeStart: 1000, rangeEnd: 1099, reportLine: "BS_1000_IntangibleAssets", reportLineLabel: "Immateriella anläggningstillgångar", confidence: "high", noteImpactFlag: true, noteType: "fixed_assets", priority: 10 },
  { rangeStart: 1100, rangeEnd: 1299, reportLine: "BS_1100_TangibleAssets", reportLineLabel: "Materiella anläggningstillgångar", confidence: "high", noteImpactFlag: true, noteType: "fixed_assets", priority: 10 },
  { rangeStart: 1300, rangeEnd: 1399, reportLine: "BS_1300_FinancialAssets", reportLineLabel: "Finansiella anläggningstillgångar", confidence: "high", noteImpactFlag: false, priority: 10 },
  { rangeStart: 1400, rangeEnd: 1499, reportLine: "BS_1400_Inventories", reportLineLabel: "Varulager m.m.", confidence: "high", noteImpactFlag: false, priority: 5 },
  { rangeStart: 1500, rangeEnd: 1699, reportLine: "BS_1500_CurrentReceivables", reportLineLabel: "Kortfristiga fordringar", confidence: "high", noteImpactFlag: false, priority: 10 },
  { rangeStart: 1700, rangeEnd: 1799, reportLine: "BS_1700_ShortTermInvestments", reportLineLabel: "Kortfristiga placeringar", confidence: "high", noteImpactFlag: false, priority: 10 },
  { rangeStart: 1800, rangeEnd: 1999, reportLine: "BS_1800_CashAndBank", reportLineLabel: "Kassa och bank", confidence: "high", noteImpactFlag: false, priority: 10 },
  { rangeStart: 2000, rangeEnd: 2099, reportLine: "BS_2000_Equity", reportLineLabel: "Eget kapital", confidence: "high", noteImpactFlag: true, noteType: "equity", priority: 10 },
  { rangeStart: 2100, rangeEnd: 2199, reportLine: "BS_2100_UntaxedReserves", reportLineLabel: "Obeskattade reserver", confidence: "high", noteImpactFlag: false, priority: 10 },
  { rangeStart: 2200, rangeEnd: 2299, reportLine: "BS_2200_Provisions", reportLineLabel: "Avsättningar", confidence: "high", noteImpactFlag: false, priority: 10 },
  { rangeStart: 2300, rangeEnd: 2499, reportLine: "BS_2300_LongTermLiabilities", reportLineLabel: "Långfristiga skulder", confidence: "high", noteImpactFlag: true, noteType: "loans", priority: 10 },
  { rangeStart: 2500, rangeEnd: 2999, reportLine: "BS_2500_CurrentLiabilities", reportLineLabel: "Kortfristiga skulder", confidence: "high", noteImpactFlag: false, priority: 10 },
  { rangeStart: 3000, rangeEnd: 3999, reportLine: "IS_3000_NetRevenue", reportLineLabel: "Nettoomsättning", confidence: "high", noteImpactFlag: false, priority: 10 },
  { rangeStart: 4000, rangeEnd: 4999, reportLine: "IS_4000_COGS", reportLineLabel: "Råvaror och förnödenheter / Handelsvaror", confidence: "high", noteImpactFlag: false, priority: 10 },
  { rangeStart: 5000, rangeEnd: 6999, reportLine: "IS_5000_ExternalCosts", reportLineLabel: "Övriga externa kostnader", confidence: "high", noteImpactFlag: false, priority: 10 },
  { rangeStart: 7000, rangeEnd: 7699, reportLine: "IS_7000_PersonnelCosts", reportLineLabel: "Personalkostnader", confidence: "high", noteImpactFlag: true, noteType: "personnel", priority: 10 },
  { rangeStart: 7700, rangeEnd: 7899, reportLine: "IS_7700_Depreciation", reportLineLabel: "Avskrivningar och nedskrivningar", confidence: "high", noteImpactFlag: true, noteType: "fixed_assets", priority: 10 },
  { rangeStart: 7900, rangeEnd: 7999, reportLine: "IS_7900_OtherOperatingCosts", reportLineLabel: "Övriga rörelsekostnader", confidence: "high", noteImpactFlag: false, priority: 10 },
  { rangeStart: 8000, rangeEnd: 8399, reportLine: "IS_8000_FinancialItems", reportLineLabel: "Finansiella intäkter och kostnader", confidence: "medium", noteImpactFlag: false, priority: 10 },
  { rangeStart: 8400, rangeEnd: 8799, reportLine: "IS_8400_Appropriations", reportLineLabel: "Bokslutsdispositioner", confidence: "medium", noteImpactFlag: false, priority: 10 },
  { rangeStart: 8800, rangeEnd: 8999, reportLine: "IS_8800_Tax", reportLineLabel: "Skatter", confidence: "high", noteImpactFlag: false, priority: 10 },
];

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

let cachedRules: MappingRuleDefinition[] | null = null;
let cachePromise: Promise<MappingRuleDefinition[]> | null = null;

async function loadRulesFromDb(): Promise<MappingRuleDefinition[]> {
  const rows = await db
    .select()
    .from(mappingRulesTable)
    .where(eq(mappingRulesTable.isActive, true));

  if (rows.length === 0) {
    logger.warn(
      "mapping_rules table is empty — falling back to bootstrap BAS rules. " +
        "Run `pnpm --filter @workspace/scripts run seed-mapping-rules` to populate the table.",
    );
    return BOOTSTRAP_RULES;
  }

  return rows
    .map((r) => ({
      rangeStart: r.accountRangeStart,
      rangeEnd: r.accountRangeEnd,
      reportLine: r.reportLine,
      reportLineLabel: r.reportLineLabel,
      confidence: r.confidence === "unmapped" ? "low" : (r.confidence as "high" | "medium" | "low"),
      noteImpactFlag: r.noteImpactFlag,
      noteType: r.noteType ?? undefined,
      priority: r.priority,
    }))
    .sort((a, b) => a.priority - b.priority);
}

async function getRules(): Promise<MappingRuleDefinition[]> {
  if (cachedRules) return cachedRules;
  if (!cachePromise) {
    cachePromise = loadRulesFromDb()
      .then((r) => {
        cachedRules = r;
        return r;
      })
      .catch((err) => {
        logger.error({ err }, "Failed to load mapping rules from DB; using bootstrap fallback");
        cachedRules = BOOTSTRAP_RULES;
        return BOOTSTRAP_RULES;
      })
      .finally(() => {
        cachePromise = null;
      });
  }
  return cachePromise;
}

/**
 * Invalidate the in-process rule cache. Call after admin writes to mapping_rules.
 */
export function reloadMappingRules(): void {
  cachedRules = null;
  cachePromise = null;
}

/**
 * Synchronous accessor for routes that already preloaded rules during request handling.
 * Returns null if the cache is cold — callers should `await getRules()` instead.
 */
export function getCachedRulesSync(): MappingRuleDefinition[] | null {
  return cachedRules;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function findRuleForAccount(
  accountNumber: string,
): Promise<MappingRuleDefinition | null> {
  const num = parseInt(accountNumber, 10);
  if (isNaN(num)) return null;
  const rules = await getRules();
  const matching = rules
    .filter((r) => num >= r.rangeStart && num <= r.rangeEnd)
    .sort((a, b) => a.priority - b.priority);
  return matching[0] ?? null;
}

export async function autoMapAccount(
  accountNumber: string,
  accountName: string | null,
): Promise<AutoMappingResult> {
  const rule = await findRuleForAccount(accountNumber);

  if (!rule) {
    return {
      accountNumber,
      accountName,
      reportLine: null,
      reportLineLabel: null,
      basRange: null,
      confidence: "unmapped",
      noteImpactFlag: false,
      noteImpactMetadata: null,
    };
  }

  const basRange = `${rule.rangeStart}-${rule.rangeEnd}`;
  const noteImpactMetadata = rule.noteImpactFlag && rule.noteType
    ? { noteType: rule.noteType, noteKey: `${rule.noteType}_${accountNumber}` }
    : null;

  return {
    accountNumber,
    accountName,
    reportLine: rule.reportLine,
    reportLineLabel: rule.reportLineLabel,
    basRange,
    confidence: rule.confidence,
    noteImpactFlag: rule.noteImpactFlag,
    noteImpactMetadata,
  };
}

export async function autoMapAccounts(
  accounts: Array<{ accountNumber: string; accountName: string | null }>,
): Promise<AutoMappingResult[]> {
  // Warm the cache once so each account doesn't hit the DB.
  await getRules();
  return Promise.all(accounts.map((a) => autoMapAccount(a.accountNumber, a.accountName)));
}

/**
 * Return the full active rule set. Used by the read-only API endpoint.
 */
export async function listAllMappingRules(): Promise<MappingRuleDefinition[]> {
  return getRules();
}
