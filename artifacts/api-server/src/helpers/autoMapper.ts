/**
 * Auto-mapping engine — server-side only.
 *
 * Maps BAS account numbers to K2/K3 report lines using Swedish BAS chart-of-accounts
 * standard ranges. Rules are ordered by priority (lower = higher priority).
 *
 * Each account gets:
 *   - reportLine: a key identifying the balance sheet / income statement position
 *   - reportLineLabel: Swedish human-readable label
 *   - confidence: "high" | "medium" | "low" | "unmapped"
 *   - noteImpactFlag: true if the account type implies a mandatory note
 *   - noteType: which note type is implicated (e.g. "fixed_assets", "personnel")
 *
 * IMPORTANT: These rules represent the common BAS standard ranges. They are
 * intentionally conservative — accounts that don't match any range clearly
 * receive "low" confidence or "unmapped" status so that users review them.
 *
 * TODO: Load rules from the mapping_rules DB table once seeded, to allow
 * dynamic rule management without code changes.
 */

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

const BAS_RULES: MappingRuleDefinition[] = [
  // ─── Immateriella anläggningstillgångar (Intangible fixed assets) ───────────
  { rangeStart: 1000, rangeEnd: 1099, reportLine: "BS_1000_IntangibleAssets", reportLineLabel: "Immateriella anläggningstillgångar", confidence: "high", noteImpactFlag: true, noteType: "fixed_assets", priority: 10 },

  // ─── Materiella anläggningstillgångar (Tangible fixed assets) ────────────────
  { rangeStart: 1100, rangeEnd: 1299, reportLine: "BS_1100_TangibleAssets", reportLineLabel: "Materiella anläggningstillgångar", confidence: "high", noteImpactFlag: true, noteType: "fixed_assets", priority: 10 },

  // ─── Finansiella anläggningstillgångar (Financial fixed assets) ──────────────
  { rangeStart: 1300, rangeEnd: 1499, reportLine: "BS_1300_FinancialAssets", reportLineLabel: "Finansiella anläggningstillgångar", confidence: "high", noteImpactFlag: false, priority: 10 },

  // ─── Varulager (Inventories) ──────────────────────────────────────────────────
  { rangeStart: 1400, rangeEnd: 1499, reportLine: "BS_1400_Inventories", reportLineLabel: "Varulager m.m.", confidence: "high", noteImpactFlag: false, priority: 5 },

  // ─── Kortfristiga fordringar (Current receivables) ────────────────────────────
  { rangeStart: 1500, rangeEnd: 1699, reportLine: "BS_1500_CurrentReceivables", reportLineLabel: "Kortfristiga fordringar", confidence: "high", noteImpactFlag: false, priority: 10 },

  // ─── Kortfristiga placeringar (Short-term investments) ────────────────────────
  { rangeStart: 1700, rangeEnd: 1799, reportLine: "BS_1700_ShortTermInvestments", reportLineLabel: "Kortfristiga placeringar", confidence: "high", noteImpactFlag: false, priority: 10 },

  // ─── Kassa och bank (Cash and bank) ──────────────────────────────────────────
  { rangeStart: 1800, rangeEnd: 1999, reportLine: "BS_1800_CashAndBank", reportLineLabel: "Kassa och bank", confidence: "high", noteImpactFlag: false, priority: 10 },

  // ─── Eget kapital (Equity) ─────────────────────────────────────────────────────
  { rangeStart: 2000, rangeEnd: 2099, reportLine: "BS_2000_Equity", reportLineLabel: "Eget kapital", confidence: "high", noteImpactFlag: true, noteType: "equity", priority: 10 },

  // ─── Obeskattade reserver (Untaxed reserves) ───────────────────────────────────
  { rangeStart: 2100, rangeEnd: 2199, reportLine: "BS_2100_UntaxedReserves", reportLineLabel: "Obeskattade reserver", confidence: "high", noteImpactFlag: false, priority: 10 },

  // ─── Avsättningar (Provisions) ───────────────────────────────────────────────
  { rangeStart: 2200, rangeEnd: 2299, reportLine: "BS_2200_Provisions", reportLineLabel: "Avsättningar", confidence: "high", noteImpactFlag: false, priority: 10 },

  // ─── Långfristiga skulder (Long-term liabilities) ──────────────────────────────
  { rangeStart: 2300, rangeEnd: 2499, reportLine: "BS_2300_LongTermLiabilities", reportLineLabel: "Långfristiga skulder", confidence: "high", noteImpactFlag: true, noteType: "loans", priority: 10 },

  // ─── Kortfristiga skulder (Current liabilities) ────────────────────────────────
  { rangeStart: 2500, rangeEnd: 2999, reportLine: "BS_2500_CurrentLiabilities", reportLineLabel: "Kortfristiga skulder", confidence: "high", noteImpactFlag: false, priority: 10 },

  // ─── Rörelsens intäkter (Revenue) ─────────────────────────────────────────────
  { rangeStart: 3000, rangeEnd: 3999, reportLine: "IS_3000_NetRevenue", reportLineLabel: "Nettoomsättning", confidence: "high", noteImpactFlag: false, priority: 10 },

  // ─── Varor, material, tjänster (COGS) ──────────────────────────────────────────
  { rangeStart: 4000, rangeEnd: 4999, reportLine: "IS_4000_COGS", reportLineLabel: "Råvaror och förnödenheter / Handelsvaror", confidence: "high", noteImpactFlag: false, priority: 10 },

  // ─── Övriga externa kostnader (Other external costs) ───────────────────────────
  { rangeStart: 5000, rangeEnd: 6999, reportLine: "IS_5000_ExternalCosts", reportLineLabel: "Övriga externa kostnader", confidence: "high", noteImpactFlag: false, priority: 10 },

  // ─── Personalkostnader (Personnel costs) ───────────────────────────────────────
  { rangeStart: 7000, rangeEnd: 7699, reportLine: "IS_7000_PersonnelCosts", reportLineLabel: "Personalkostnader", confidence: "high", noteImpactFlag: true, noteType: "personnel", priority: 10 },

  // ─── Av- och nedskrivningar (Depreciation) ─────────────────────────────────────
  { rangeStart: 7700, rangeEnd: 7899, reportLine: "IS_7700_Depreciation", reportLineLabel: "Avskrivningar och nedskrivningar", confidence: "high", noteImpactFlag: true, noteType: "fixed_assets", priority: 10 },

  // ─── Övriga rörelsekostnader (Other operating costs) ───────────────────────────
  { rangeStart: 7900, rangeEnd: 7999, reportLine: "IS_7900_OtherOperatingCosts", reportLineLabel: "Övriga rörelsekostnader", confidence: "high", noteImpactFlag: false, priority: 10 },

  // ─── Finansiella intäkter och kostnader (Financial items) ──────────────────────
  { rangeStart: 8000, rangeEnd: 8399, reportLine: "IS_8000_FinancialItems", reportLineLabel: "Finansiella intäkter och kostnader", confidence: "medium", noteImpactFlag: false, priority: 10 },

  // ─── Bokslutsdispositioner (Year-end appropriations) ────────────────────────────
  { rangeStart: 8400, rangeEnd: 8799, reportLine: "IS_8400_Appropriations", reportLineLabel: "Bokslutsdispositioner", confidence: "medium", noteImpactFlag: false, priority: 10 },

  // ─── Skatter (Taxes) ────────────────────────────────────────────────────────────
  { rangeStart: 8800, rangeEnd: 8999, reportLine: "IS_8800_Tax", reportLineLabel: "Skatter", confidence: "high", noteImpactFlag: false, priority: 10 },
];

export function findRuleForAccount(accountNumber: string): MappingRuleDefinition | null {
  const num = parseInt(accountNumber, 10);
  if (isNaN(num)) return null;

  const matching = BAS_RULES
    .filter((r) => num >= r.rangeStart && num <= r.rangeEnd)
    .sort((a, b) => a.priority - b.priority);

  return matching[0] ?? null;
}

export function autoMapAccount(
  accountNumber: string,
  accountName: string | null,
): AutoMappingResult {
  const rule = findRuleForAccount(accountNumber);

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

export function autoMapAccounts(
  accounts: Array<{ accountNumber: string; accountName: string | null }>,
): AutoMappingResult[] {
  return accounts.map((a) => autoMapAccount(a.accountNumber, a.accountName));
}
