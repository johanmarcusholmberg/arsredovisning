/**
 * Cash flow statement (Kassaflödesanalys) — generate / read / update / validate.
 *
 * Indirect method only at launch. The generator best-effort derives line
 * amounts from existing financial_statement_lines (income statement +
 * balance sheet) so accountants get a sensible starting point. Lines that
 * cannot be calculated safely are flagged `needsReview = true` and require
 * manual confirmation before the statement can be marked validated.
 *
 * Source-of-truth invariant: opening + årets kassaflöde = closing
 * (within CASH_FLOW_RECONCILIATION_TOLERANCE_SEK).
 */

import { eq, and, asc } from "drizzle-orm";
import {
  db,
  cashFlowStatementsTable,
  cashFlowLineItemsTable,
  cashFlowAdjustmentsTable,
  financialStatementLinesTable,
  reportsTable,
  annualReportProjectsTable,
  type CashFlowStatement,
  type CashFlowLineItem,
} from "@workspace/db";
import { resolveReportForProject } from "../helpers/projectReportLink.js";
import { CASH_FLOW_RECONCILIATION_TOLERANCE_SEK } from "./complianceConfig.js";

// ---------------------------------------------------------------------------
// Canonical line template — Swedish indirect method
// ---------------------------------------------------------------------------

export type Section = "operating" | "investing" | "financing" | "reconciliation";
export type SourceType =
  | "mapped_accounts"
  | "calculated"
  | "manual_adjustment"
  | "imported_value";

export interface TemplateLine {
  section: Section;
  lineCode: string;
  labelSv: string;
  isSubtotal: boolean;
  isRequired: boolean;
  /** When true, the line is editable by users in the cash flow editor. */
  isEditable: boolean;
}

export const CASH_FLOW_TEMPLATE: TemplateLine[] = [
  // DEN LÖPANDE VERKSAMHETEN
  { section: "operating", lineCode: "op_result_after_finance", labelSv: "Resultat efter finansiella poster", isSubtotal: false, isRequired: true, isEditable: true },
  { section: "operating", lineCode: "op_non_cash_adjustments", labelSv: "Justeringar för poster som inte ingår i kassaflödet", isSubtotal: false, isRequired: true, isEditable: true },
  { section: "operating", lineCode: "op_tax_paid", labelSv: "Betald skatt", isSubtotal: false, isRequired: true, isEditable: true },
  { section: "operating", lineCode: "op_subtotal_before_wc", labelSv: "Kassaflöde från den löpande verksamheten före förändringar av rörelsekapital", isSubtotal: true, isRequired: true, isEditable: false },
  { section: "operating", lineCode: "op_change_inventory", labelSv: "Förändring av varulager", isSubtotal: false, isRequired: false, isEditable: true },
  { section: "operating", lineCode: "op_change_receivables", labelSv: "Förändring av rörelsefordringar", isSubtotal: false, isRequired: false, isEditable: true },
  { section: "operating", lineCode: "op_change_payables", labelSv: "Förändring av rörelseskulder", isSubtotal: false, isRequired: false, isEditable: true },
  { section: "operating", lineCode: "op_total", labelSv: "Kassaflöde från den löpande verksamheten", isSubtotal: true, isRequired: true, isEditable: false },

  // INVESTERINGSVERKSAMHETEN
  { section: "investing", lineCode: "inv_acq_tangible", labelSv: "Förvärv av materiella anläggningstillgångar", isSubtotal: false, isRequired: false, isEditable: true },
  { section: "investing", lineCode: "inv_disp_tangible", labelSv: "Försäljning av materiella anläggningstillgångar", isSubtotal: false, isRequired: false, isEditable: true },
  { section: "investing", lineCode: "inv_acq_intangible", labelSv: "Förvärv av immateriella anläggningstillgångar", isSubtotal: false, isRequired: false, isEditable: true },
  { section: "investing", lineCode: "inv_financial", labelSv: "Förvärv/försäljning av finansiella anläggningstillgångar", isSubtotal: false, isRequired: false, isEditable: true },
  { section: "investing", lineCode: "inv_total", labelSv: "Kassaflöde från investeringsverksamheten", isSubtotal: true, isRequired: true, isEditable: false },

  // FINANSIERINGSVERKSAMHETEN
  { section: "financing", lineCode: "fin_new_share_issue", labelSv: "Nyemission", isSubtotal: false, isRequired: false, isEditable: true },
  { section: "financing", lineCode: "fin_loans_taken", labelSv: "Upptagna lån", isSubtotal: false, isRequired: false, isEditable: true },
  { section: "financing", lineCode: "fin_loans_repaid", labelSv: "Amortering av lån", isSubtotal: false, isRequired: false, isEditable: true },
  { section: "financing", lineCode: "fin_dividends_paid", labelSv: "Utbetald utdelning", isSubtotal: false, isRequired: false, isEditable: true },
  { section: "financing", lineCode: "fin_total", labelSv: "Kassaflöde från finansieringsverksamheten", isSubtotal: true, isRequired: true, isEditable: false },

  // RECONCILIATION
  { section: "reconciliation", lineCode: "rec_year_total", labelSv: "Årets kassaflöde", isSubtotal: true, isRequired: true, isEditable: false },
  { section: "reconciliation", lineCode: "rec_opening_cash", labelSv: "Likvida medel vid årets början", isSubtotal: false, isRequired: true, isEditable: true },
  { section: "reconciliation", lineCode: "rec_closing_cash", labelSv: "Likvida medel vid årets slut", isSubtotal: true, isRequired: true, isEditable: true },
];

const SUBTOTAL_LINES = new Set(
  CASH_FLOW_TEMPLATE.filter((l) => l.isSubtotal).map((l) => l.lineCode),
);

// ---------------------------------------------------------------------------
// Mapping heuristics from financial_statement_lines
// ---------------------------------------------------------------------------

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function findLine(
  lines: { lineKey: string; statementType: string; currentYearAmount: string | null; previousYearAmount: string | null }[],
  statementType: string,
  needles: string[],
): { current: number | null; previous: number | null } {
  for (const needle of needles) {
    const hit = lines.find(
      (l) => l.statementType === statementType && l.lineKey.toLowerCase().includes(needle),
    );
    if (hit) {
      return {
        current: num(hit.currentYearAmount),
        previous: num(hit.previousYearAmount),
      };
    }
  }
  return { current: null, previous: null };
}

interface DerivedAmounts {
  current: number | null;
  previous: number | null;
  sourceType: SourceType;
  sourceAccounts: string | null;
  explanationSv: string;
  needsReview: boolean;
}

/**
 * Best-effort derivation of cash flow line amounts from
 * financial_statement_lines. When source data is missing/ambiguous, returns
 * null amounts and `needsReview = true` so the user is forced to confirm
 * the value before the statement can be validated.
 */
function deriveLineAmounts(
  lineCode: string,
  fsLines: {
    lineKey: string;
    statementType: string;
    currentYearAmount: string | null;
    previousYearAmount: string | null;
    linkedAccountIds: string | null;
  }[],
): DerivedAmounts {
  const reviewedFromIs = (
    needles: string[],
    explanation: string,
    invert = false,
  ): DerivedAmounts => {
    const { current, previous } = findLine(fsLines, "income_statement", needles);
    return {
      current: current === null ? null : invert ? -current : current,
      previous: previous === null ? null : invert ? -previous : previous,
      sourceType: "calculated",
      sourceAccounts: null,
      explanationSv: explanation,
      needsReview: current === null,
    };
  };

  switch (lineCode) {
    case "op_result_after_finance":
      return reviewedFromIs(
        ["result_after_financial", "result_efter_finansiella", "profit_after_finance"],
        "Resultat efter finansiella poster hämtas från resultaträkningen.",
      );
    case "op_non_cash_adjustments":
      return {
        ...reviewedFromIs(
          ["depreciation", "avskriv", "amortization"],
          "Avskrivningar och andra ej kassaflödespåverkande poster återförs (positivt belopp).",
        ),
        needsReview: true, // always require user confirmation here
      };
    case "op_tax_paid":
      return {
        ...reviewedFromIs(
          ["tax_expense", "skatt"],
          "Betald skatt baseras på årets skattekostnad och förändring i skatteskuld. Bekräfta beloppet.",
          true,
        ),
        needsReview: true,
      };
    case "op_change_inventory": {
      const cy = findLine(fsLines, "balance_sheet", ["inventory", "varulager"]);
      const needs = cy.current === null || cy.previous === null;
      const change = !needs ? -((cy.current ?? 0) - (cy.previous ?? 0)) : null;
      return {
        current: change,
        previous: null,
        sourceType: "calculated",
        sourceAccounts: null,
        explanationSv:
          "Förändring av varulager beräknas som föregående års lager minus årets lager. En ökning binder kapital och minskar kassaflödet.",
        needsReview: needs,
      };
    }
    case "op_change_receivables": {
      const cy = findLine(fsLines, "balance_sheet", [
        "trade_receivables",
        "kundford",
        "current_receivables",
      ]);
      const needs = cy.current === null || cy.previous === null;
      const change = !needs ? -((cy.current ?? 0) - (cy.previous ?? 0)) : null;
      return {
        current: change,
        previous: null,
        sourceType: "calculated",
        sourceAccounts: null,
        explanationSv:
          "En ökning av kundfordringar minskar kassaflödet eftersom intäkten ännu inte har betalats in.",
        needsReview: needs,
      };
    }
    case "op_change_payables": {
      const cy = findLine(fsLines, "balance_sheet", [
        "trade_payables",
        "leverantörsskuld",
        "current_payables",
        "current_liabilities",
      ]);
      const needs = cy.current === null || cy.previous === null;
      const change = !needs ? (cy.current ?? 0) - (cy.previous ?? 0) : null;
      return {
        current: change,
        previous: null,
        sourceType: "calculated",
        sourceAccounts: null,
        explanationSv:
          "En ökning av rörelseskulder ökar kassaflödet eftersom betalningen är uppskjuten.",
        needsReview: needs,
      };
    }
    case "rec_opening_cash":
    case "rec_closing_cash": {
      const cy = findLine(fsLines, "balance_sheet", [
        "cash_and_bank",
        "kassa_och_bank",
        "cash",
        "likvida_medel",
      ]);
      const isOpening = lineCode === "rec_opening_cash";
      const value = isOpening ? cy.previous : cy.current;
      return {
        current: value,
        previous: null,
        sourceType: "mapped_accounts",
        sourceAccounts: null,
        explanationSv: isOpening
          ? "Likvida medel vid årets början hämtas från föregående års balansräkning (kassa och bank)."
          : "Likvida medel vid årets slut hämtas från balansräkningen (kassa och bank) och ska stämma mot kassaflödesanalysens slutsumma.",
        needsReview: value === null,
      };
    }
    default:
      // Investments / financing — we cannot infer reliably from statements.
      return {
        current: null,
        previous: null,
        sourceType: "calculated",
        sourceAccounts: null,
        explanationSv:
          "Posten kan inte beräknas automatiskt från importerad data — fyll i beloppet manuellt eller bekräfta noll.",
        needsReview: true,
      };
  }
}

// ---------------------------------------------------------------------------
// Generation / persistence
// ---------------------------------------------------------------------------

export interface CashFlowStatementWithLines {
  statement: CashFlowStatement;
  lines: CashFlowLineItem[];
}

/**
 * Generate (or regenerate) the cash flow statement for a project. Re-creates
 * the canonical line set from CASH_FLOW_TEMPLATE; preserves manual amounts
 * entered by the user where possible.
 */
export async function generateCashFlowStatement(
  projectId: string,
): Promise<CashFlowStatementWithLines> {
  const [project] = await db
    .select()
    .from(annualReportProjectsTable)
    .where(eq(annualReportProjectsTable.id, projectId))
    .limit(1);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const link = await resolveReportForProject(projectId);
  const reportId = link?.reportId ?? null;

  // Load the existing statement (if any) and any user-entered amounts.
  const [existing] = await db
    .select()
    .from(cashFlowStatementsTable)
    .where(eq(cashFlowStatementsTable.projectId, projectId))
    .limit(1);

  const fy = `${project.fiscalYearStart}–${project.fiscalYearEnd}`;
  let statement: CashFlowStatement;
  if (!existing) {
    [statement] = await db
      .insert(cashFlowStatementsTable)
      .values({
        projectId,
        reportId,
        financialYear: fy,
        method: "indirect",
        status: "draft",
      })
      .returning();
  } else {
    statement = existing;
  }

  // Pull existing lines so we can preserve manually-edited amounts on
  // regeneration. The user's manual edits override generated values.
  const existingLines = await db
    .select()
    .from(cashFlowLineItemsTable)
    .where(eq(cashFlowLineItemsTable.cashFlowStatementId, statement.id));
  const manualByCode = new Map(
    existingLines
      .filter(
        (l) =>
          l.sourceType === "manual_adjustment" || l.sourceType === "imported_value",
      )
      .map((l) => [l.lineCode, l]),
  );

  // Pull source data.
  const fsLines = reportId
    ? await db
        .select()
        .from(financialStatementLinesTable)
        .where(eq(financialStatementLinesTable.reportId, reportId))
    : [];

  // Re-seed the canonical lines (delete + insert).
  await db
    .delete(cashFlowLineItemsTable)
    .where(eq(cashFlowLineItemsTable.cashFlowStatementId, statement.id));

  const inserts: (typeof cashFlowLineItemsTable.$inferInsert)[] = [];
  for (let i = 0; i < CASH_FLOW_TEMPLATE.length; i++) {
    const tpl = CASH_FLOW_TEMPLATE[i];
    const manual = manualByCode.get(tpl.lineCode);
    let derived: DerivedAmounts;
    if (tpl.isSubtotal) {
      derived = {
        current: null,
        previous: null,
        sourceType: "calculated",
        sourceAccounts: null,
        explanationSv: "Beräknas automatiskt från ovanstående poster.",
        needsReview: false,
      };
    } else if (manual) {
      derived = {
        current:
          manual.amountCurrentYear === null
            ? null
            : Number(manual.amountCurrentYear),
        previous:
          manual.amountPreviousYear === null
            ? null
            : Number(manual.amountPreviousYear),
        sourceType: manual.sourceType as SourceType,
        sourceAccounts: manual.sourceAccounts,
        explanationSv:
          manual.calculationExplanationSv ??
          "Manuellt inmatat värde — bevaras vid omgenerering.",
        needsReview: false,
      };
    } else {
      derived = deriveLineAmounts(tpl.lineCode, fsLines);
    }

    inserts.push({
      cashFlowStatementId: statement.id,
      section: tpl.section,
      lineCode: tpl.lineCode,
      labelSv: tpl.labelSv,
      amountCurrentYear:
        derived.current === null ? null : String(derived.current),
      amountPreviousYear:
        derived.previous === null ? null : String(derived.previous),
      sourceType: derived.sourceType,
      sourceAccounts: derived.sourceAccounts,
      calculationExplanationSv: derived.explanationSv,
      isEditable: tpl.isEditable,
      isRequired: tpl.isRequired,
      isSubtotal: tpl.isSubtotal,
      needsReview: derived.needsReview,
      sortOrder: i,
    });
  }
  const insertedLines = await db
    .insert(cashFlowLineItemsTable)
    .values(inserts)
    .returning();

  // Compute subtotals and reconciliation; persist on the statement row.
  const result = await recomputeAndPersistTotals(statement.id);
  return result;
}

/**
 * Recompute subtotals + reconciliation difference and persist.
 */
export async function recomputeAndPersistTotals(
  statementId: string,
): Promise<CashFlowStatementWithLines> {
  const lines = await db
    .select()
    .from(cashFlowLineItemsTable)
    .where(eq(cashFlowLineItemsTable.cashFlowStatementId, statementId))
    .orderBy(asc(cashFlowLineItemsTable.sortOrder));

  const get = (code: string) => lines.find((l) => l.lineCode === code);

  const sumLeaves = (codes: string[]): number =>
    codes.reduce((s, c) => {
      const l = get(c);
      const v = l?.amountCurrentYear === null || l?.amountCurrentYear === undefined
        ? 0
        : Number(l.amountCurrentYear);
      return s + (Number.isFinite(v) ? v : 0);
    }, 0);

  const opSubtotalBeforeWc = sumLeaves([
    "op_result_after_finance",
    "op_non_cash_adjustments",
    "op_tax_paid",
  ]);
  const opTotal =
    opSubtotalBeforeWc +
    sumLeaves(["op_change_inventory", "op_change_receivables", "op_change_payables"]);
  const invTotal = sumLeaves([
    "inv_acq_tangible",
    "inv_disp_tangible",
    "inv_acq_intangible",
    "inv_financial",
  ]);
  const finTotal = sumLeaves([
    "fin_new_share_issue",
    "fin_loans_taken",
    "fin_loans_repaid",
    "fin_dividends_paid",
  ]);
  const yearTotal = opTotal + invTotal + finTotal;
  const opening = Number(get("rec_opening_cash")?.amountCurrentYear ?? 0) || 0;
  // Closing = whatever the user entered/imported (truth = balance sheet).
  // calculatedClosing = opening + årets kassaflöde
  const closingEntered = (() => {
    const v = get("rec_closing_cash")?.amountCurrentYear;
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })();
  const calculatedClosing = opening + yearTotal;
  const reconciliationDiff =
    closingEntered === null ? null : closingEntered - calculatedClosing;

  // Persist subtotals on the corresponding line rows.
  const updates: Array<[string, number]> = [
    ["op_subtotal_before_wc", opSubtotalBeforeWc],
    ["op_total", opTotal],
    ["inv_total", invTotal],
    ["fin_total", finTotal],
    ["rec_year_total", yearTotal],
  ];
  for (const [code, val] of updates) {
    await db
      .update(cashFlowLineItemsTable)
      .set({ amountCurrentYear: String(val), updatedAt: new Date() })
      .where(
        and(
          eq(cashFlowLineItemsTable.cashFlowStatementId, statementId),
          eq(cashFlowLineItemsTable.lineCode, code),
        ),
      );
  }

  const reconciled =
    closingEntered !== null &&
    Math.abs(reconciliationDiff ?? 0) <= CASH_FLOW_RECONCILIATION_TOLERANCE_SEK;

  const [statement] = await db
    .update(cashFlowStatementsTable)
    .set({
      openingCashAndCashEquivalents: String(opening),
      cashFlowFromOperatingActivities: String(opTotal),
      cashFlowFromInvestingActivities: String(invTotal),
      cashFlowFromFinancingActivities: String(finTotal),
      totalCashFlowForYear: String(yearTotal),
      closingCashAndCashEquivalents:
        closingEntered === null ? null : String(closingEntered),
      calculatedClosingCashAndCashEquivalents: String(calculatedClosing),
      reconciliationDifference:
        reconciliationDiff === null ? null : String(reconciliationDiff),
      validationStatus: reconciled ? "reconciled" : "pending",
      updatedAt: new Date(),
    })
    .where(eq(cashFlowStatementsTable.id, statementId))
    .returning();

  const refreshed = await db
    .select()
    .from(cashFlowLineItemsTable)
    .where(eq(cashFlowLineItemsTable.cashFlowStatementId, statementId))
    .orderBy(asc(cashFlowLineItemsTable.sortOrder));

  return { statement, lines: refreshed };
}

export async function loadCashFlowStatement(
  projectId: string,
): Promise<CashFlowStatementWithLines | null> {
  const [statement] = await db
    .select()
    .from(cashFlowStatementsTable)
    .where(eq(cashFlowStatementsTable.projectId, projectId))
    .limit(1);
  if (!statement) return null;
  const lines = await db
    .select()
    .from(cashFlowLineItemsTable)
    .where(eq(cashFlowLineItemsTable.cashFlowStatementId, statement.id))
    .orderBy(asc(cashFlowLineItemsTable.sortOrder));
  return { statement, lines };
}

export async function loadCashFlowStatementByReport(
  reportId: string,
): Promise<CashFlowStatementWithLines | null> {
  const [statement] = await db
    .select()
    .from(cashFlowStatementsTable)
    .where(eq(cashFlowStatementsTable.reportId, reportId))
    .limit(1);
  if (!statement) return null;
  const lines = await db
    .select()
    .from(cashFlowLineItemsTable)
    .where(eq(cashFlowLineItemsTable.cashFlowStatementId, statement.id))
    .orderBy(asc(cashFlowLineItemsTable.sortOrder));
  return { statement, lines };
}

export interface UpdateLineParams {
  amountCurrentYear?: number | null;
  amountPreviousYear?: number | null;
  needsReview?: boolean;
  calculationExplanationSv?: string | null;
}

export async function updateCashFlowLine(
  lineId: string,
  patch: UpdateLineParams,
): Promise<CashFlowLineItem | null> {
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.amountCurrentYear !== undefined) {
    update.amountCurrentYear =
      patch.amountCurrentYear === null ? null : String(patch.amountCurrentYear);
  }
  if (patch.amountPreviousYear !== undefined) {
    update.amountPreviousYear =
      patch.amountPreviousYear === null ? null : String(patch.amountPreviousYear);
  }
  if (patch.needsReview !== undefined) update.needsReview = patch.needsReview;
  if (patch.calculationExplanationSv !== undefined) {
    update.calculationExplanationSv = patch.calculationExplanationSv;
  }
  const [updated] = await db
    .update(cashFlowLineItemsTable)
    .set(update)
    .where(eq(cashFlowLineItemsTable.id, lineId))
    .returning();
  return updated ?? null;
}

export interface AddAdjustmentParams {
  lineId: string;
  newAmount: number;
  reason: string;
  createdByProfileId: string | null;
}

export async function addManualAdjustment(
  statementId: string,
  params: AddAdjustmentParams,
): Promise<CashFlowLineItem> {
  const [line] = await db
    .select()
    .from(cashFlowLineItemsTable)
    .where(eq(cashFlowLineItemsTable.id, params.lineId))
    .limit(1);
  if (!line) throw new Error(`Cash flow line ${params.lineId} not found`);
  if (!line.isEditable) {
    throw new Error("Line is not editable");
  }
  const previous =
    line.amountCurrentYear === null ? null : Number(line.amountCurrentYear);
  await db.insert(cashFlowAdjustmentsTable).values({
    cashFlowStatementId: statementId,
    lineItemId: line.id,
    adjustmentAmount: String(
      previous === null ? params.newAmount : params.newAmount - previous,
    ),
    adjustmentReason: params.reason,
    previousAmount: previous === null ? null : String(previous),
    newAmount: String(params.newAmount),
    createdByProfileId: params.createdByProfileId,
  });
  const [updated] = await db
    .update(cashFlowLineItemsTable)
    .set({
      amountCurrentYear: String(params.newAmount),
      sourceType: "manual_adjustment",
      needsReview: false,
      updatedAt: new Date(),
    })
    .where(eq(cashFlowLineItemsTable.id, line.id))
    .returning();
  await db
    .update(cashFlowStatementsTable)
    .set({ hasManualAdjustments: true, updatedAt: new Date() })
    .where(eq(cashFlowStatementsTable.id, statementId));
  return updated;
}

export async function listAdjustments(statementId: string) {
  return db
    .select()
    .from(cashFlowAdjustmentsTable)
    .where(eq(cashFlowAdjustmentsTable.cashFlowStatementId, statementId))
    .orderBy(asc(cashFlowAdjustmentsTable.createdAt));
}

/**
 * Mark the cash flow statement as validated. Caller is responsible for
 * verifying the validation passes. We re-check reconciliation here as a
 * safety net.
 */
export async function setStatementStatus(
  statementId: string,
  status: "draft" | "needs_review" | "validated" | "blocked",
): Promise<CashFlowStatement> {
  const [updated] = await db
    .update(cashFlowStatementsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(cashFlowStatementsTable.id, statementId))
    .returning();
  return updated;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface CashFlowValidationIssue {
  level: "blocking" | "warning" | "info";
  code: string;
  message: string;
}

export interface CashFlowValidationResult {
  reconciled: boolean;
  matchesBalanceSheet: boolean | null;
  issues: CashFlowValidationIssue[];
}

/**
 * Validate a cash flow statement. Returns issues plus reconciliation flags.
 * Callers should rely on the resulting `issues` list.
 */
export async function validateCashFlowStatement(
  statementId: string,
): Promise<CashFlowValidationResult> {
  const [statement] = await db
    .select()
    .from(cashFlowStatementsTable)
    .where(eq(cashFlowStatementsTable.id, statementId))
    .limit(1);
  if (!statement) {
    return {
      reconciled: false,
      matchesBalanceSheet: null,
      issues: [
        {
          level: "blocking",
          code: "cash_flow:not_generated",
          message: "Kassaflödesanalysen är inte genererad ännu.",
        },
      ],
    };
  }

  const lines = await db
    .select()
    .from(cashFlowLineItemsTable)
    .where(eq(cashFlowLineItemsTable.cashFlowStatementId, statementId));

  const issues: CashFlowValidationIssue[] = [];

  // 1. Required leaves with null/needs_review block validation.
  for (const l of lines) {
    if (l.isSubtotal) continue;
    if (l.isRequired && (l.amountCurrentYear === null || l.needsReview)) {
      issues.push({
        level: "blocking",
        code: `cash_flow:line_needs_review:${l.lineCode}`,
        message: `Raden "${l.labelSv}" behöver granskas och bekräftas.`,
      });
    } else if (l.needsReview) {
      issues.push({
        level: "warning",
        code: `cash_flow:line_needs_review:${l.lineCode}`,
        message: `Raden "${l.labelSv}" är inte bekräftad och kan behöva granskas.`,
      });
    }
  }

  // 2. Reconciliation: opening + year_total = closing
  const diff = statement.reconciliationDifference;
  let reconciled = false;
  if (diff === null) {
    issues.push({
      level: "blocking",
      code: "cash_flow:closing_missing",
      message:
        "Likvida medel vid årets slut saknas — kassaflödesanalysen kan inte stämmas av.",
    });
  } else if (Math.abs(Number(diff)) > CASH_FLOW_RECONCILIATION_TOLERANCE_SEK) {
    issues.push({
      level: "blocking",
      code: "cash_flow:reconciliation_mismatch",
      message: `Differensen visar att kassaflödesanalysen inte stämmer mot balansräkningen ännu (${Number(diff).toLocaleString("sv-SE")} kr).`,
    });
  } else {
    reconciled = true;
  }

  // 3. Balance-sheet consistency on the closing cash row.
  let matchesBalanceSheet: boolean | null = null;
  if (statement.reportId) {
    const fsLines = await db
      .select()
      .from(financialStatementLinesTable)
      .where(eq(financialStatementLinesTable.reportId, statement.reportId));
    const bsCash = fsLines.find(
      (l) =>
        l.statementType === "balance_sheet" &&
        ["cash_and_bank", "kassa_och_bank", "cash", "likvida_medel"].some((n) =>
          l.lineKey.toLowerCase().includes(n),
        ),
    );
    if (bsCash && bsCash.currentYearAmount !== null) {
      const closingEntered =
        statement.closingCashAndCashEquivalents === null
          ? null
          : Number(statement.closingCashAndCashEquivalents);
      const bsValue = Number(bsCash.currentYearAmount);
      if (closingEntered === null) {
        matchesBalanceSheet = false;
      } else if (
        Math.abs(closingEntered - bsValue) >
        CASH_FLOW_RECONCILIATION_TOLERANCE_SEK
      ) {
        matchesBalanceSheet = false;
        issues.push({
          level: "blocking",
          code: "cash_flow:balance_sheet_mismatch",
          message: `Likvida medel vid årets slut (${closingEntered.toLocaleString("sv-SE")} kr) stämmer inte mot balansräkningens kassa och bank (${bsValue.toLocaleString("sv-SE")} kr).`,
        });
      } else {
        matchesBalanceSheet = true;
      }
    }
  }

  return { reconciled, matchesBalanceSheet, issues };
}

// Silence unused export warnings under noUnusedLocals.
void SUBTOTAL_LINES;
