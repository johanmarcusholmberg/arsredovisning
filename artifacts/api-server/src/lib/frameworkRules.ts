/**
 * frameworkRules.ts — K2 / K3 Swedish annual report line templates.
 *
 * This is the single source of truth for:
 *  - Which statement lines exist per framework
 *  - Swedish labels, sort order, subtotal/total/heading flags
 *  - Which account group ranges map to which line key
 *  - Which line keys trigger automatic note reference suggestions
 *  - Whether cash flow is required
 *  - BRF label overrides
 */

export type StatementType = "income_statement" | "balance_sheet" | "cash_flow";

export interface LineTemplate {
  lineKey: string;
  swedishLabel: string;
  statementType: StatementType;
  sortOrder: number;
  isHeading: boolean;
  isSubtotal: boolean;
  isTotal: boolean;
  calculationMethod: "sum" | "derived" | "manual";
  accountRanges?: [number, number][];
  suggestedNoteType?: string;
  brfLabelOverride?: string;
  k2Only?: boolean;
  k3Only?: boolean;
}

export interface FrameworkRules {
  framework: "K2" | "K3";
  incomeStatement: LineTemplate[];
  balanceSheet: LineTemplate[];
  cashFlow: LineTemplate[];
  requiredSections: string[];
  noteRequirements: NoteRequirement[];
}

export interface NoteRequirement {
  noteType: string;
  swedishLabel: string;
  lineKeys: string[];
  required: boolean;
}

export interface ReportStructureSection {
  key: string;
  sweLabel: string;
  included: boolean;
  conditional: boolean;
  conditionNote?: string;
  sortOrder: number;
}

// ─── Income Statement Line Templates ────────────────────────────────────────

const incomeStatementLines: LineTemplate[] = [
  {
    lineKey: "heading_rorelseintakter",
    swedishLabel: "Rörelsens intäkter",
    statementType: "income_statement",
    sortOrder: 10,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
    brfLabelOverride: "Rörelsens intäkter",
  },
  {
    lineKey: "nettoomsattning",
    swedishLabel: "Nettoomsättning",
    statementType: "income_statement",
    sortOrder: 11,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[3000, 3999]],
    suggestedNoteType: "revenue",
    brfLabelOverride: "Årsavgifter och hyror",
  },
  {
    lineKey: "ovriga_rorelseintakter",
    swedishLabel: "Övriga rörelseintäkter",
    statementType: "income_statement",
    sortOrder: 12,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[3800, 3899]],
  },
  {
    lineKey: "heading_rorelsekostnader",
    swedishLabel: "Rörelsens kostnader",
    statementType: "income_statement",
    sortOrder: 20,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "handelsvaror",
    swedishLabel: "Handelsvaror",
    statementType: "income_statement",
    sortOrder: 21,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[4000, 4999]],
  },
  {
    lineKey: "ravaror_fornodenheter",
    swedishLabel: "Råvaror och förnödenheter",
    statementType: "income_statement",
    sortOrder: 22,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[4000, 4099]],
  },
  {
    lineKey: "ovriga_externa_kostnader",
    swedishLabel: "Övriga externa kostnader",
    statementType: "income_statement",
    sortOrder: 23,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[5000, 6999]],
    suggestedNoteType: "external_costs",
  },
  {
    lineKey: "personalkostnader",
    swedishLabel: "Personalkostnader",
    statementType: "income_statement",
    sortOrder: 24,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[7000, 7699]],
    suggestedNoteType: "personnel",
  },
  {
    lineKey: "av_nedskrivningar",
    swedishLabel: "Av- och nedskrivningar av materiella och immateriella anläggningstillgångar",
    statementType: "income_statement",
    sortOrder: 25,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[7700, 7899]],
    suggestedNoteType: "depreciation",
  },
  {
    lineKey: "ovriga_rorelsekostnader",
    swedishLabel: "Övriga rörelsekostnader",
    statementType: "income_statement",
    sortOrder: 26,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[7900, 7999]],
  },
  {
    lineKey: "rorelseresultat",
    swedishLabel: "Rörelseresultat",
    statementType: "income_statement",
    sortOrder: 30,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
  },
  {
    lineKey: "heading_finansiella",
    swedishLabel: "Finansiella poster",
    statementType: "income_statement",
    sortOrder: 40,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "resultat_andelar_koncern",
    swedishLabel: "Resultat från andelar i koncernföretag",
    statementType: "income_statement",
    sortOrder: 41,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[8000, 8099]],
  },
  {
    lineKey: "resultat_andelar_intresse",
    swedishLabel: "Resultat från andelar i intresseföretag",
    statementType: "income_statement",
    sortOrder: 42,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[8100, 8199]],
  },
  {
    lineKey: "ranteintakter",
    swedishLabel: "Övriga ränteintäkter och liknande resultatposter",
    statementType: "income_statement",
    sortOrder: 43,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[8200, 8299]],
  },
  {
    lineKey: "nedskrivningar_finansiella",
    swedishLabel: "Nedskrivningar av finansiella anläggningstillgångar och kortfristiga placeringar",
    statementType: "income_statement",
    sortOrder: 44,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[8300, 8399]],
    k3Only: true,
  },
  {
    lineKey: "rantekostnader",
    swedishLabel: "Räntekostnader och liknande resultatposter",
    statementType: "income_statement",
    sortOrder: 45,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[8400, 8499]],
  },
  {
    lineKey: "resultat_efter_finansiella",
    swedishLabel: "Resultat efter finansiella poster",
    statementType: "income_statement",
    sortOrder: 50,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
  },
  {
    lineKey: "bokslutsdispositioner",
    swedishLabel: "Bokslutsdispositioner",
    statementType: "income_statement",
    sortOrder: 60,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[8800, 8899]],
    suggestedNoteType: "appropriations",
  },
  {
    lineKey: "skatt_arets_resultat",
    swedishLabel: "Skatt på årets resultat",
    statementType: "income_statement",
    sortOrder: 70,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[8900, 8999]],
  },
  {
    lineKey: "arets_resultat",
    swedishLabel: "Årets resultat",
    statementType: "income_statement",
    sortOrder: 80,
    isHeading: false,
    isSubtotal: false,
    isTotal: true,
    calculationMethod: "derived",
  },
];

// ─── Balance Sheet Line Templates ───────────────────────────────────────────

const balanceSheetLines: LineTemplate[] = [
  // ── ASSETS ──
  {
    lineKey: "heading_tillgangar",
    swedishLabel: "TILLGÅNGAR",
    statementType: "balance_sheet",
    sortOrder: 10,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "heading_anlaggningstillgangar",
    swedishLabel: "Anläggningstillgångar",
    statementType: "balance_sheet",
    sortOrder: 20,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "heading_immateriella",
    swedishLabel: "Immateriella anläggningstillgångar",
    statementType: "balance_sheet",
    sortOrder: 30,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "balanserade_utgifter",
    swedishLabel: "Balanserade utgifter för forskning och utveckling",
    statementType: "balance_sheet",
    sortOrder: 31,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1010, 1019]],
    suggestedNoteType: "intangible_assets",
  },
  {
    lineKey: "patent_licenser",
    swedishLabel: "Patent, licenser, varumärken",
    statementType: "balance_sheet",
    sortOrder: 32,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1020, 1049]],
    suggestedNoteType: "intangible_assets",
  },
  {
    lineKey: "goodwill",
    swedishLabel: "Goodwill",
    statementType: "balance_sheet",
    sortOrder: 33,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1070, 1079]],
    suggestedNoteType: "intangible_assets",
  },
  {
    lineKey: "summa_immateriella",
    swedishLabel: "Summa immateriella anläggningstillgångar",
    statementType: "balance_sheet",
    sortOrder: 39,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
  },
  {
    lineKey: "heading_materiella",
    swedishLabel: "Materiella anläggningstillgångar",
    statementType: "balance_sheet",
    sortOrder: 40,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "byggnader_mark",
    swedishLabel: "Byggnader och mark",
    statementType: "balance_sheet",
    sortOrder: 41,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1100, 1199]],
    suggestedNoteType: "tangible_assets",
    brfLabelOverride: "Byggnader och mark",
  },
  {
    lineKey: "maskiner_tekniska",
    swedishLabel: "Maskiner och andra tekniska anläggningar",
    statementType: "balance_sheet",
    sortOrder: 42,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1200, 1249]],
    suggestedNoteType: "tangible_assets",
  },
  {
    lineKey: "inventarier",
    swedishLabel: "Inventarier, verktyg och installationer",
    statementType: "balance_sheet",
    sortOrder: 43,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1250, 1289]],
    suggestedNoteType: "tangible_assets",
  },
  {
    lineKey: "forbattringsutgifter",
    swedishLabel: "Förbättringsutgifter på annans fastighet",
    statementType: "balance_sheet",
    sortOrder: 44,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1290, 1299]],
    suggestedNoteType: "tangible_assets",
  },
  {
    lineKey: "pagaende_nyanlaggningar",
    swedishLabel: "Pågående nyanläggningar och förskott avseende materiella anläggningstillgångar",
    statementType: "balance_sheet",
    sortOrder: 45,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1380, 1399]],
  },
  {
    lineKey: "summa_materiella",
    swedishLabel: "Summa materiella anläggningstillgångar",
    statementType: "balance_sheet",
    sortOrder: 49,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
  },
  {
    lineKey: "heading_finansiella_anl",
    swedishLabel: "Finansiella anläggningstillgångar",
    statementType: "balance_sheet",
    sortOrder: 50,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "andelar_koncernforetag",
    swedishLabel: "Andelar i koncernföretag",
    statementType: "balance_sheet",
    sortOrder: 51,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1300, 1319]],
    suggestedNoteType: "financial_assets",
  },
  {
    lineKey: "andra_langfristiga_fordringar",
    swedishLabel: "Andra långfristiga fordringar",
    statementType: "balance_sheet",
    sortOrder: 52,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1380, 1389]],
    suggestedNoteType: "financial_assets",
  },
  {
    lineKey: "summa_finansiella_anl",
    swedishLabel: "Summa finansiella anläggningstillgångar",
    statementType: "balance_sheet",
    sortOrder: 59,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
  },
  {
    lineKey: "summa_anlaggningstillgangar",
    swedishLabel: "Summa anläggningstillgångar",
    statementType: "balance_sheet",
    sortOrder: 69,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
  },
  {
    lineKey: "heading_omsattningstillgangar",
    swedishLabel: "Omsättningstillgångar",
    statementType: "balance_sheet",
    sortOrder: 70,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "heading_varulager",
    swedishLabel: "Varulager m.m.",
    statementType: "balance_sheet",
    sortOrder: 71,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "fardiga_varor",
    swedishLabel: "Färdiga varor och handelsvaror",
    statementType: "balance_sheet",
    sortOrder: 72,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1400, 1499]],
  },
  {
    lineKey: "heading_kortfristiga_fordringar",
    swedishLabel: "Kortfristiga fordringar",
    statementType: "balance_sheet",
    sortOrder: 80,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "kundfordringar",
    swedishLabel: "Kundfordringar",
    statementType: "balance_sheet",
    sortOrder: 81,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1500, 1599]],
  },
  {
    lineKey: "ovriga_kortfristiga_fordringar",
    swedishLabel: "Övriga kortfristiga fordringar",
    statementType: "balance_sheet",
    sortOrder: 82,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1600, 1699]],
  },
  {
    lineKey: "forutbetalda_upplupna_int",
    swedishLabel: "Förutbetalda kostnader och upplupna intäkter",
    statementType: "balance_sheet",
    sortOrder: 83,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1700, 1799]],
  },
  {
    lineKey: "kassa_bank",
    swedishLabel: "Kassa och bank",
    statementType: "balance_sheet",
    sortOrder: 90,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[1900, 1999]],
  },
  {
    lineKey: "summa_omsattningstillgangar",
    swedishLabel: "Summa omsättningstillgångar",
    statementType: "balance_sheet",
    sortOrder: 99,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
  },
  {
    lineKey: "summa_tillgangar",
    swedishLabel: "SUMMA TILLGÅNGAR",
    statementType: "balance_sheet",
    sortOrder: 100,
    isHeading: false,
    isSubtotal: false,
    isTotal: true,
    calculationMethod: "derived",
  },
  // ── EQUITY & LIABILITIES ──
  {
    lineKey: "heading_eget_kapital_skulder",
    swedishLabel: "EGET KAPITAL OCH SKULDER",
    statementType: "balance_sheet",
    sortOrder: 110,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "heading_eget_kapital",
    swedishLabel: "Eget kapital",
    statementType: "balance_sheet",
    sortOrder: 120,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "heading_bundet_eget_kapital",
    swedishLabel: "Bundet eget kapital",
    statementType: "balance_sheet",
    sortOrder: 121,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
    brfLabelOverride: "Inre reparationsfond",
  },
  {
    lineKey: "aktiekapital",
    swedishLabel: "Aktiekapital",
    statementType: "balance_sheet",
    sortOrder: 122,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[2081, 2081]],
    suggestedNoteType: "equity",
    brfLabelOverride: "Inre reparationsfond",
  },
  {
    lineKey: "overkursfond",
    swedishLabel: "Överkursfond",
    statementType: "balance_sheet",
    sortOrder: 123,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[2097, 2097]],
    suggestedNoteType: "equity",
  },
  {
    lineKey: "reservfond",
    swedishLabel: "Reservfond",
    statementType: "balance_sheet",
    sortOrder: 124,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[2085, 2085]],
    suggestedNoteType: "equity",
  },
  {
    lineKey: "summa_bundet_eget_kapital",
    swedishLabel: "Summa bundet eget kapital",
    statementType: "balance_sheet",
    sortOrder: 129,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
  },
  {
    lineKey: "heading_fritt_eget_kapital",
    swedishLabel: "Fritt eget kapital",
    statementType: "balance_sheet",
    sortOrder: 130,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "balanserat_resultat",
    swedishLabel: "Balanserat resultat",
    statementType: "balance_sheet",
    sortOrder: 131,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[2090, 2096]],
    suggestedNoteType: "equity",
  },
  {
    lineKey: "arets_resultat_bs",
    swedishLabel: "Årets resultat",
    statementType: "balance_sheet",
    sortOrder: 132,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "derived",
    suggestedNoteType: "equity",
  },
  {
    lineKey: "summa_fritt_eget_kapital",
    swedishLabel: "Summa fritt eget kapital",
    statementType: "balance_sheet",
    sortOrder: 139,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
  },
  {
    lineKey: "summa_eget_kapital",
    swedishLabel: "Summa eget kapital",
    statementType: "balance_sheet",
    sortOrder: 149,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
    suggestedNoteType: "equity",
  },
  {
    lineKey: "obeskattade_reserver",
    swedishLabel: "Obeskattade reserver",
    statementType: "balance_sheet",
    sortOrder: 150,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[2100, 2199]],
    suggestedNoteType: "appropriations",
  },
  {
    lineKey: "heading_avsattningar",
    swedishLabel: "Avsättningar",
    statementType: "balance_sheet",
    sortOrder: 160,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "avsattningar_pensioner",
    swedishLabel: "Avsättningar för pensioner och liknande",
    statementType: "balance_sheet",
    sortOrder: 161,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[2210, 2219]],
  },
  {
    lineKey: "ovriga_avsattningar",
    swedishLabel: "Övriga avsättningar",
    statementType: "balance_sheet",
    sortOrder: 162,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[2220, 2299]],
  },
  {
    lineKey: "heading_langfristiga_skulder",
    swedishLabel: "Långfristiga skulder",
    statementType: "balance_sheet",
    sortOrder: 170,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "skulder_kreditinstitut_lf",
    swedishLabel: "Skulder till kreditinstitut",
    statementType: "balance_sheet",
    sortOrder: 171,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[2300, 2399]],
    suggestedNoteType: "long_term_liabilities",
  },
  {
    lineKey: "ovriga_langfristiga_skulder",
    swedishLabel: "Övriga långfristiga skulder",
    statementType: "balance_sheet",
    sortOrder: 172,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[2400, 2499]],
    suggestedNoteType: "long_term_liabilities",
  },
  {
    lineKey: "summa_langfristiga_skulder",
    swedishLabel: "Summa långfristiga skulder",
    statementType: "balance_sheet",
    sortOrder: 179,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
    suggestedNoteType: "long_term_liabilities",
  },
  {
    lineKey: "heading_kortfristiga_skulder",
    swedishLabel: "Kortfristiga skulder",
    statementType: "balance_sheet",
    sortOrder: 180,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "skulder_kreditinstitut_kf",
    swedishLabel: "Skulder till kreditinstitut",
    statementType: "balance_sheet",
    sortOrder: 181,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[2800, 2849]],
  },
  {
    lineKey: "leverantorsskulder",
    swedishLabel: "Leverantörsskulder",
    statementType: "balance_sheet",
    sortOrder: 182,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[2400, 2499]],
  },
  {
    lineKey: "skatteskulder",
    swedishLabel: "Skatteskulder",
    statementType: "balance_sheet",
    sortOrder: 183,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[2500, 2599]],
  },
  {
    lineKey: "ovriga_kortfristiga_skulder",
    swedishLabel: "Övriga kortfristiga skulder",
    statementType: "balance_sheet",
    sortOrder: 184,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[2600, 2799]],
  },
  {
    lineKey: "upplupna_kostnader",
    swedishLabel: "Upplupna kostnader och förutbetalda intäkter",
    statementType: "balance_sheet",
    sortOrder: 185,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
    accountRanges: [[2900, 2999]],
  },
  {
    lineKey: "summa_kortfristiga_skulder",
    swedishLabel: "Summa kortfristiga skulder",
    statementType: "balance_sheet",
    sortOrder: 189,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
  },
  {
    lineKey: "summa_eget_kapital_skulder",
    swedishLabel: "SUMMA EGET KAPITAL OCH SKULDER",
    statementType: "balance_sheet",
    sortOrder: 200,
    isHeading: false,
    isSubtotal: false,
    isTotal: true,
    calculationMethod: "derived",
  },
];

// ─── Cash Flow Placeholder Lines ─────────────────────────────────────────────

const cashFlowLines: LineTemplate[] = [
  {
    lineKey: "heading_lopande_verksamhet",
    swedishLabel: "Den löpande verksamheten",
    statementType: "cash_flow",
    sortOrder: 10,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "rorelseresultat_kassaflode",
    swedishLabel: "Rörelseresultat",
    statementType: "cash_flow",
    sortOrder: 11,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "derived",
  },
  {
    lineKey: "justeringar",
    swedishLabel: "Justeringar för poster som inte ingår i kassaflödet",
    statementType: "cash_flow",
    sortOrder: 12,
    isHeading: false,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "sum",
  },
  {
    lineKey: "kassaflode_lopande",
    swedishLabel: "Kassaflöde från den löpande verksamheten",
    statementType: "cash_flow",
    sortOrder: 19,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
  },
  {
    lineKey: "heading_investeringsverksamhet",
    swedishLabel: "Investeringsverksamheten",
    statementType: "cash_flow",
    sortOrder: 20,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "kassaflode_investeringar",
    swedishLabel: "Kassaflöde från investeringsverksamheten",
    statementType: "cash_flow",
    sortOrder: 29,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
  },
  {
    lineKey: "heading_finansieringsverksamhet",
    swedishLabel: "Finansieringsverksamheten",
    statementType: "cash_flow",
    sortOrder: 30,
    isHeading: true,
    isSubtotal: false,
    isTotal: false,
    calculationMethod: "manual",
  },
  {
    lineKey: "kassaflode_finansiering",
    swedishLabel: "Kassaflöde från finansieringsverksamheten",
    statementType: "cash_flow",
    sortOrder: 39,
    isHeading: false,
    isSubtotal: true,
    isTotal: false,
    calculationMethod: "derived",
  },
  {
    lineKey: "arets_kassaflode",
    swedishLabel: "Årets kassaflöde",
    statementType: "cash_flow",
    sortOrder: 50,
    isHeading: false,
    isSubtotal: false,
    isTotal: true,
    calculationMethod: "derived",
  },
];

// ─── Note Requirements ───────────────────────────────────────────────────────

const noteRequirements: NoteRequirement[] = [
  {
    noteType: "accounting_principles",
    swedishLabel: "Redovisnings- och värderingsprinciper",
    lineKeys: [],
    required: true,
  },
  {
    noteType: "revenue",
    swedishLabel: "Nettoomsättning",
    lineKeys: ["nettoomsattning"],
    required: false,
  },
  {
    noteType: "personnel",
    swedishLabel: "Anställda och personalkostnader",
    lineKeys: ["personalkostnader"],
    required: true,
  },
  {
    noteType: "depreciation",
    swedishLabel: "Av- och nedskrivningar",
    lineKeys: ["av_nedskrivningar"],
    required: false,
  },
  {
    noteType: "intangible_assets",
    swedishLabel: "Immateriella anläggningstillgångar",
    lineKeys: ["balanserade_utgifter", "patent_licenser", "goodwill"],
    required: false,
  },
  {
    noteType: "tangible_assets",
    swedishLabel: "Materiella anläggningstillgångar",
    lineKeys: ["byggnader_mark", "maskiner_tekniska", "inventarier"],
    required: false,
  },
  {
    noteType: "financial_assets",
    swedishLabel: "Finansiella anläggningstillgångar",
    lineKeys: ["andelar_koncernforetag", "andra_langfristiga_fordringar"],
    required: false,
  },
  {
    noteType: "equity",
    swedishLabel: "Eget kapital",
    lineKeys: ["aktiekapital", "balanserat_resultat", "arets_resultat_bs", "summa_eget_kapital"],
    required: true,
  },
  {
    noteType: "appropriations",
    swedishLabel: "Bokslutsdispositioner och obeskattade reserver",
    lineKeys: ["bokslutsdispositioner", "obeskattade_reserver"],
    required: false,
  },
  {
    noteType: "long_term_liabilities",
    swedishLabel: "Långfristiga skulder",
    lineKeys: ["skulder_kreditinstitut_lf", "ovriga_langfristiga_skulder", "summa_langfristiga_skulder"],
    required: false,
  },
];

// ─── Framework Definitions ───────────────────────────────────────────────────

function buildFramework(framework: "K2" | "K3"): FrameworkRules {
  const filter = (lines: LineTemplate[]) =>
    lines.filter((l) => {
      if (l.k2Only && framework === "K3") return false;
      if (l.k3Only && framework === "K2") return false;
      return true;
    });

  return {
    framework,
    incomeStatement: filter(incomeStatementLines),
    balanceSheet: filter(balanceSheetLines),
    cashFlow: filter(cashFlowLines),
    requiredSections:
      framework === "K3"
        ? [
            "omslag",
            "forvaltningsberattelse",
            "resultatrakning",
            "balansrakning",
            "kassaflodesanalys",
            "noter",
            "underskrifter",
          ]
        : ["omslag", "forvaltningsberattelse", "resultatrakning", "balansrakning", "noter", "underskrifter"],
    noteRequirements,
  };
}

export const K3_RULES = buildFramework("K3");
export const K2_RULES = buildFramework("K2");

export function getFrameworkRules(framework: "K2" | "K3"): FrameworkRules {
  return framework === "K2" ? K2_RULES : K3_RULES;
}

/**
 * Returns true if cash flow is required for the given framework.
 * K3 always requires it; K2 requires it for larger companies (size threshold handled in a later phase).
 */
export function isCashFlowRequired(framework: "K2" | "K3", cashFlowOverride?: boolean): boolean {
  if (cashFlowOverride !== undefined) return cashFlowOverride;
  return framework === "K3";
}

/**
 * Apply BRF (bostadsrättsförening) label overrides to a list of resolved line templates.
 */
export function applyBrfLabels(lines: LineTemplate[]): LineTemplate[] {
  return lines.map((l) =>
    l.brfLabelOverride ? { ...l, swedishLabel: l.brfLabelOverride } : l,
  );
}

/**
 * Determine whether an account number falls in any of the given ranges.
 */
export function accountInRanges(accountNumber: number, ranges: [number, number][]): boolean {
  return ranges.some(([min, max]) => accountNumber >= min && accountNumber <= max);
}

/**
 * Given a line key, find its suggested note type in the framework rules.
 */
export function getSuggestedNoteType(
  lineKey: string,
  framework: "K2" | "K3",
): string | undefined {
  const rules = getFrameworkRules(framework);
  const allLines = [...rules.incomeStatement, ...rules.balanceSheet, ...rules.cashFlow];
  return allLines.find((l) => l.lineKey === lineKey)?.suggestedNoteType;
}

/**
 * Build the Swedish report structure section list for a given project.
 */
export function buildReportStructure(
  framework: "K2" | "K3",
  legalForm: string,
  cashFlowRequired: boolean,
): ReportStructureSection[] {
  const isBrf = legalForm.toLowerCase().includes("brf") ||
    legalForm.toLowerCase().includes("bostadsrättsförening");

  const sections: ReportStructureSection[] = [
    {
      key: "omslag",
      sweLabel: "Omslag",
      included: true,
      conditional: false,
      sortOrder: 1,
    },
    {
      key: "forvaltningsberattelse",
      sweLabel: "Förvaltningsberättelse",
      included: true,
      conditional: false,
      sortOrder: 2,
    },
    {
      key: "resultatrakning",
      sweLabel: isBrf ? "Resultaträkning (BRF)" : "Resultaträkning",
      included: true,
      conditional: false,
      sortOrder: 3,
    },
    {
      key: "balansrakning",
      sweLabel: isBrf ? "Balansräkning (BRF)" : "Balansräkning",
      included: true,
      conditional: false,
      sortOrder: 4,
    },
    {
      key: "kassaflodesanalys",
      sweLabel: "Kassaflödesanalys",
      included: cashFlowRequired,
      conditional: !cashFlowRequired,
      conditionNote: cashFlowRequired
        ? undefined
        : "Krävs enligt K3 och för större företag",
      sortOrder: 5,
    },
    {
      key: "noter",
      sweLabel: "Noter",
      included: true,
      conditional: false,
      sortOrder: 6,
    },
    {
      key: "underskrifter",
      sweLabel: "Underskrifter",
      included: true,
      conditional: false,
      sortOrder: 7,
    },
    {
      key: "revisionsberattelse",
      sweLabel: "Revisionsberättelse",
      included: false,
      conditional: true,
      conditionNote: "Krävs om företaget är revisionspliktigt",
      sortOrder: 8,
    },
  ];

  return sections.sort((a, b) => a.sortOrder - b.sortOrder);
}
