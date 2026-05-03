/**
 * Cash-flow source data layer.
 *
 * Reads the best-available underlying accounting data for cash-flow
 * derivation, in the priority order required by the spec:
 *
 *   1. Raw staging account balances from the confirmed import batch
 *      (staging_accounts.opening_balance / closing_balance).
 *   2. Existing report-line account mapping (account_mappings).
 *   3. BAS default classification (cashFlowBasClassifier).
 *   4. User overrides (cash_flow_account_classifications).
 *
 * The output is a list of `AccountMovement` rows — one per relevant account
 * — each carrying its movement, classification, source, confidence, and
 * (when applicable) a Swedish review reason.
 *
 * No silent guessing: when the underlying data is missing or ambiguous, we
 * mark the account as needing manual review rather than fabricating numbers.
 *
 * Per-account traceability is only populated when raw account balances are
 * available. When we have to fall back to aggregated financial-statement
 * lines, the consumer (cashFlowStatementService) substitutes a generic
 * "Detaljerat källkonto saknas" explanation.
 */

import { eq, and, desc } from "drizzle-orm";
import {
  db,
  importBatchesTable,
  stagingAccountsTable,
  accountMappingsTable,
  cashFlowAccountClassificationsTable,
  type CashFlowAccountClassification,
} from "@workspace/db";
import {
  classifyByBas,
  type BasClassification,
} from "./cashFlowBasClassifier.js";

export type CfClassification =
  CashFlowAccountClassification["classification"];
export type CfClassificationSource =
  CashFlowAccountClassification["classificationSource"];

export interface AccountMovement {
  accountNumber: string;
  accountName: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  /** closing - opening (null if either side is null). */
  movement: number | null;
  /** Mapped balance-sheet / income-statement line key, if any. */
  fsReportLine: string | null;
  fsReportLineLabel: string | null;
  classification: CfClassification;
  classificationSource: CfClassificationSource;
  confidence: "high" | "medium" | "low" | "unmapped";
  excludeFromCashFlow: boolean;
  needsManualReview: boolean;
  reviewReasonSv: string | null;
  /** True when the user explicitly chose this classification. */
  isUserOverridden: boolean;
}

export interface AccountMovementBundle {
  /** Whether per-account balances were available (= source data exists). */
  hasAccountLevelData: boolean;
  /** Movements grouped by classification for fast lookup. */
  byClassification: Map<CfClassification, AccountMovement[]>;
  /** Flat list, useful for traceability + UI listings. */
  all: AccountMovement[];
}

const NUMERIC = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Resolve the latest confirmed import batch for a project. Cash-flow
 * derivation must only ever look at confirmed staging data.
 */
async function findConfirmedBatchId(
  projectId: string,
): Promise<string | null> {
  const [batch] = await db
    .select({ id: importBatchesTable.id })
    .from(importBatchesTable)
    .where(
      and(
        eq(importBatchesTable.projectId, projectId),
        eq(importBatchesTable.status, "confirmed"),
      ),
    )
    .orderBy(desc(importBatchesTable.confirmedAt))
    .limit(1);
  return batch?.id ?? null;
}

/**
 * Refine BAS classification using the existing balance-sheet mapping. If a
 * BAS-default classification disagrees with the report mapping, prefer the
 * report mapping (it has been reviewed by the user during the mapping step)
 * and bump confidence up.
 */
function refineWithMapping(
  bas: BasClassification,
  reportLine: string | null,
): { classification: CfClassification; source: CfClassificationSource; confidence: "high" | "medium" | "low" } {
  if (!reportLine) {
    return {
      classification: bas.classification,
      source: "bas_default",
      confidence: bas.confidence,
    };
  }
  const key = reportLine.toLowerCase();
  // Best-effort keyword refinement on the canonical report line key.
  if (key.includes("cash") || key.includes("kassa") || key.includes("bank") || key.includes("likvid")) {
    return { classification: "cash_and_cash_equivalents", source: "report_mapping", confidence: "high" };
  }
  if (key.includes("inventory") || key.includes("varulager")) {
    return { classification: "inventory", source: "report_mapping", confidence: "high" };
  }
  if (key.includes("receivable") || key.includes("kundford") || key.includes("ford")) {
    return { classification: "receivables", source: "report_mapping", confidence: "high" };
  }
  if (key.includes("trade_payable") || key.includes("leverantörsskuld") || key.includes("leverantorsskuld")) {
    return { classification: "operating_liabilities", source: "report_mapping", confidence: "high" };
  }
  if (key.includes("loan") || key.includes("lån") || key.includes("lan_")) {
    // Cannot tell short vs long without more info; trust BAS's choice.
    return { classification: bas.classification === "short_term_interest_bearing_loans" ? "short_term_interest_bearing_loans" : "long_term_loans", source: "report_mapping", confidence: "high" };
  }
  if (key.includes("equity") || key.includes("eget_kapital")) {
    return { classification: "equity", source: "report_mapping", confidence: "high" };
  }
  if (key.includes("tax") || key.includes("skatt")) {
    return { classification: "tax", source: "report_mapping", confidence: "high" };
  }
  if (key.includes("depreciation") || key.includes("avskriv") || key.includes("amortization")) {
    return { classification: "non_cash_adjustment", source: "report_mapping", confidence: "high" };
  }
  if (key.includes("intangible") || key.includes("immateriell")) {
    return { classification: "intangible_fixed_assets", source: "report_mapping", confidence: "high" };
  }
  if (key.includes("tangible") || key.includes("materiell")) {
    return { classification: "tangible_fixed_assets", source: "report_mapping", confidence: "high" };
  }
  if (key.includes("financial_fixed") || key.includes("finansiell_anlagg")) {
    return { classification: "financial_fixed_assets", source: "report_mapping", confidence: "high" };
  }
  // No keyword refinement — keep BAS decision but mark source as report_mapping.
  return {
    classification: bas.classification,
    source: bas.confidence === "high" ? "bas_default" : "report_mapping",
    confidence: bas.confidence === "high" ? "high" : "medium",
  };
}

/**
 * Seed `cash_flow_account_classifications` rows for any staging accounts
 * that don't yet have one. User overrides are never touched. Called
 * automatically before derivation to keep the override table in sync with
 * the latest confirmed batch.
 */
export async function seedClassificationsForProject(
  projectId: string,
): Promise<void> {
  const batchId = await findConfirmedBatchId(projectId);
  if (!batchId) return;

  const accounts = await db
    .select()
    .from(stagingAccountsTable)
    .where(
      and(
        eq(stagingAccountsTable.batchId, batchId),
        eq(stagingAccountsTable.projectId, projectId),
      ),
    );
  if (accounts.length === 0) return;

  const existing = await db
    .select()
    .from(cashFlowAccountClassificationsTable)
    .where(eq(cashFlowAccountClassificationsTable.projectId, projectId));
  const existingByAccount = new Map(existing.map((r) => [r.accountNumber, r]));

  const mappings = await db
    .select()
    .from(accountMappingsTable)
    .where(eq(accountMappingsTable.projectId, projectId));
  const mappingByAccount = new Map(mappings.map((m) => [m.accountNumber, m]));

  const inserts: (typeof cashFlowAccountClassificationsTable.$inferInsert)[] = [];
  for (const a of accounts) {
    if (existingByAccount.has(a.accountNumber)) continue;
    const mapping = mappingByAccount.get(a.accountNumber) ?? null;
    const bas = classifyByBas(a.accountNumber, a.accountName);
    const refined = refineWithMapping(bas, mapping?.reportLine ?? null);
    inserts.push({
      projectId,
      accountNumber: a.accountNumber,
      accountName: a.accountName,
      classification: refined.classification,
      classificationSource: refined.source,
      confidence: refined.confidence,
      excludeFromCashFlow: refined.classification === "exclude",
      needsManualReview: bas.reviewReasonSv !== null && refined.confidence !== "high",
      reviewReasonSv: refined.confidence === "high" ? null : bas.reviewReasonSv,
    });
  }
  if (inserts.length > 0) {
    await db
      .insert(cashFlowAccountClassificationsTable)
      .values(inserts)
      .onConflictDoNothing();
  }
}

/**
 * Load the full account-movement bundle for a project. Returns
 * `hasAccountLevelData = false` when no confirmed batch with staging
 * accounts is available — the caller should then fall back to the
 * aggregated financial-statement lines.
 */
export async function loadAccountMovements(
  projectId: string,
): Promise<AccountMovementBundle> {
  const batchId = await findConfirmedBatchId(projectId);
  const empty: AccountMovementBundle = {
    hasAccountLevelData: false,
    byClassification: new Map(),
    all: [],
  };
  if (!batchId) return empty;

  // Make sure overrides table has a row for every staging account.
  await seedClassificationsForProject(projectId);

  const accounts = await db
    .select()
    .from(stagingAccountsTable)
    .where(
      and(
        eq(stagingAccountsTable.batchId, batchId),
        eq(stagingAccountsTable.projectId, projectId),
      ),
    );
  if (accounts.length === 0) return empty;

  const overrides = await db
    .select()
    .from(cashFlowAccountClassificationsTable)
    .where(eq(cashFlowAccountClassificationsTable.projectId, projectId));
  const overrideByAccount = new Map(overrides.map((r) => [r.accountNumber, r]));

  const mappings = await db
    .select()
    .from(accountMappingsTable)
    .where(eq(accountMappingsTable.projectId, projectId));
  const mappingByAccount = new Map(mappings.map((m) => [m.accountNumber, m]));

  const movements: AccountMovement[] = accounts.map((a) => {
    const opening = NUMERIC(a.openingBalance);
    const closing = NUMERIC(a.closingBalance);
    const movement =
      opening === null || closing === null ? null : closing - opening;
    const mapping = mappingByAccount.get(a.accountNumber) ?? null;
    const override = overrideByAccount.get(a.accountNumber);
    let classification: CfClassification;
    let source: CfClassificationSource;
    let confidence: "high" | "medium" | "low" | "unmapped";
    let needsReview: boolean;
    let reviewReasonSv: string | null;
    let excludeFromCashFlow: boolean;
    let isUserOverridden = false;

    if (override && override.classificationSource === "manual_override") {
      classification = override.classification;
      source = "manual_override";
      confidence = "high";
      needsReview = override.needsManualReview;
      reviewReasonSv = override.reviewReasonSv;
      excludeFromCashFlow = override.excludeFromCashFlow;
      isUserOverridden = true;
    } else if (override) {
      // Seeded but not overridden — use seed values.
      classification = override.classification;
      source = override.classificationSource;
      confidence = override.confidence;
      needsReview = override.needsManualReview;
      reviewReasonSv = override.reviewReasonSv;
      excludeFromCashFlow = override.excludeFromCashFlow;
    } else {
      const bas = classifyByBas(a.accountNumber, a.accountName);
      const refined = refineWithMapping(bas, mapping?.reportLine ?? null);
      classification = refined.classification;
      source = refined.source;
      confidence = refined.confidence;
      needsReview = bas.reviewReasonSv !== null && refined.confidence !== "high";
      reviewReasonSv = refined.confidence === "high" ? null : bas.reviewReasonSv;
      excludeFromCashFlow = classification === "exclude";
    }

    return {
      accountNumber: a.accountNumber,
      accountName: a.accountName,
      openingBalance: opening,
      closingBalance: closing,
      movement,
      fsReportLine: mapping?.reportLine ?? null,
      fsReportLineLabel: mapping?.reportLineLabel ?? null,
      classification,
      classificationSource: source,
      confidence,
      excludeFromCashFlow,
      needsManualReview: needsReview,
      reviewReasonSv,
      isUserOverridden,
    };
  });

  const byClass = new Map<CfClassification, AccountMovement[]>();
  for (const m of movements) {
    if (m.excludeFromCashFlow) continue;
    const arr = byClass.get(m.classification) ?? [];
    arr.push(m);
    byClass.set(m.classification, arr);
  }

  return {
    hasAccountLevelData: true,
    byClassification: byClass,
    all: movements,
  };
}

/**
 * Sum the *change* (closing − opening) of the accounts in a given
 * classification. Returns null if any contributing account has missing
 * balances (i.e. don't silently treat missing data as zero).
 */
export function sumClassificationMovement(
  bundle: AccountMovementBundle,
  classification: CfClassification,
): { total: number | null; accounts: AccountMovement[]; hasMissing: boolean } {
  const accounts = bundle.byClassification.get(classification) ?? [];
  if (accounts.length === 0) {
    return { total: null, accounts: [], hasMissing: false };
  }
  let total = 0;
  let hasMissing = false;
  for (const a of accounts) {
    if (a.movement === null) {
      hasMissing = true;
      continue;
    }
    total += a.movement;
  }
  return { total: hasMissing ? null : total, accounts, hasMissing };
}

/**
 * Sum the *closing balance* of the accounts in a given classification.
 */
export function sumClassificationClosing(
  bundle: AccountMovementBundle,
  classification: CfClassification,
): { total: number | null; accounts: AccountMovement[] } {
  const accounts = bundle.byClassification.get(classification) ?? [];
  if (accounts.length === 0) return { total: null, accounts: [] };
  let total = 0;
  let any = false;
  for (const a of accounts) {
    if (a.closingBalance === null) continue;
    any = true;
    total += a.closingBalance;
  }
  return { total: any ? total : null, accounts };
}

export function sumClassificationOpening(
  bundle: AccountMovementBundle,
  classification: CfClassification,
): { total: number | null; accounts: AccountMovement[] } {
  const accounts = bundle.byClassification.get(classification) ?? [];
  if (accounts.length === 0) return { total: null, accounts: [] };
  let total = 0;
  let any = false;
  for (const a of accounts) {
    if (a.openingBalance === null) continue;
    any = true;
    total += a.openingBalance;
  }
  return { total: any ? total : null, accounts };
}
