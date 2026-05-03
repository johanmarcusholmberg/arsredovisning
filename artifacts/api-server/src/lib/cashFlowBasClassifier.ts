/**
 * BAS account-range classifier for cash-flow purposes.
 *
 * Maps a BAS account number to a cash-flow classification using the standard
 * Swedish BAS chart-of-accounts ranges. The ranges are intentionally
 * conservative — anything ambiguous returns "other_unclear" with a Swedish
 * review reason so the user is forced to confirm.
 *
 * Sources:
 *   1xxx — assets
 *     10xx, 11xx       → intangible / fixed assets
 *     12xx             → tangible fixed assets
 *     13xx             → financial fixed assets
 *     14xx             → inventory
 *     15xx             → trade receivables
 *     16xx, 17xx       → other receivables / prepayments
 *     19xx             → cash & bank
 *   2xxx — equity & liabilities
 *     20xx             → equity
 *     21xx             → untaxed reserves (treated as equity for CF)
 *     22xx             → provisions (review)
 *     23xx             → long-term liabilities (loans)
 *     24xx             → trade payables / short-term operating liab
 *     25xx             → tax liabilities
 *     26xx, 27xx       → VAT & employee/payroll liabilities
 *     28xx             → other short-term liabilities (often loans → review)
 *     29xx             → accruals (operating)
 *   3xxx-8xxx          → P&L (not relevant per-account for indirect method;
 *                        depreciation 78xx flagged as non-cash adjustment)
 */

import type { CashFlowAccountClassification } from "@workspace/db";

export type CfClass =
  (typeof CASH_FLOW_CLASSIFICATIONS)[number];

export const CASH_FLOW_CLASSIFICATIONS = [
  "cash_and_cash_equivalents",
  "receivables",
  "inventory",
  "operating_liabilities",
  "tax",
  "non_cash_adjustment",
  "tangible_fixed_assets",
  "intangible_fixed_assets",
  "financial_fixed_assets",
  "long_term_loans",
  "short_term_interest_bearing_loans",
  "equity",
  "dividends",
  "other_unclear",
  "exclude",
] as const;

export interface BasClassification {
  classification: CashFlowAccountClassification["classification"];
  confidence: "high" | "medium" | "low";
  /** Swedish review reason when classification is uncertain. Null if confident. */
  reviewReasonSv: string | null;
}

/**
 * Classify a BAS account number for cash-flow purposes.
 * Returns "other_unclear" + a Swedish review reason if the range is ambiguous
 * or outside the recognised ranges.
 */
export function classifyByBas(
  accountNumber: string,
  accountName: string | null = null,
): BasClassification {
  const n = parseInt(accountNumber, 10);
  if (!Number.isFinite(n)) {
    return {
      classification: "other_unclear",
      confidence: "low",
      reviewReasonSv: "Konto behöver klassificeras",
    };
  }

  // ── Assets (1xxx) ──────────────────────────────────────────────────────
  if (n >= 1000 && n <= 1099) {
    return {
      classification: "intangible_fixed_assets",
      confidence: "high",
      reviewReasonSv: null,
    };
  }
  if (n >= 1100 && n <= 1199) {
    // 11xx is buildings/land — tangible
    return {
      classification: "tangible_fixed_assets",
      confidence: "high",
      reviewReasonSv: null,
    };
  }
  if (n >= 1200 && n <= 1299) {
    return {
      classification: "tangible_fixed_assets",
      confidence: "high",
      reviewReasonSv: null,
    };
  }
  if (n >= 1300 && n <= 1399) {
    return {
      classification: "financial_fixed_assets",
      confidence: "high",
      reviewReasonSv: null,
    };
  }
  if (n >= 1400 && n <= 1499) {
    return {
      classification: "inventory",
      confidence: "high",
      reviewReasonSv: null,
    };
  }
  if (n >= 1500 && n <= 1599) {
    return {
      classification: "receivables",
      confidence: "high",
      reviewReasonSv: null,
    };
  }
  if (n >= 1600 && n <= 1799) {
    // Other receivables, prepayments, accrued income — operating receivables.
    return {
      classification: "receivables",
      confidence: "medium",
      reviewReasonSv: null,
    };
  }
  if (n >= 1800 && n <= 1899) {
    // Short-term placements / securities — usually financial assets.
    return {
      classification: "financial_fixed_assets",
      confidence: "low",
      reviewReasonSv:
        "Kortfristiga placeringar — bekräfta om de ska räknas som likvida medel eller finansiell tillgång.",
    };
  }
  if (n >= 1900 && n <= 1999) {
    return {
      classification: "cash_and_cash_equivalents",
      confidence: "high",
      reviewReasonSv: null,
    };
  }

  // ── Equity & liabilities (2xxx) ────────────────────────────────────────
  if (n >= 2000 && n <= 2099) {
    return {
      classification: "equity",
      confidence: "high",
      reviewReasonSv:
        "Eget kapital-rörelse kräver manuell klassificering",
    };
  }
  if (n >= 2100 && n <= 2199) {
    // Untaxed reserves — non-cash adjustment in the indirect method
    return {
      classification: "non_cash_adjustment",
      confidence: "medium",
      reviewReasonSv: null,
    };
  }
  if (n >= 2200 && n <= 2299) {
    // Provisions — non-cash adjustment but can reverse via cash payments.
    return {
      classification: "non_cash_adjustment",
      confidence: "low",
      reviewReasonSv:
        "Avsättningar — kan vara delvis kassapåverkande, bekräfta klassificering.",
    };
  }
  if (n >= 2300 && n <= 2399) {
    return {
      classification: "long_term_loans",
      confidence: "high",
      reviewReasonSv:
        "Lånerörelse kan inte delas upp mellan upptagna lån och amortering",
    };
  }
  if (n >= 2400 && n <= 2499) {
    return {
      classification: "operating_liabilities",
      confidence: "high",
      reviewReasonSv: null,
    };
  }
  if (n >= 2500 && n <= 2599) {
    return {
      classification: "tax",
      confidence: "high",
      reviewReasonSv: null,
    };
  }
  if (n >= 2600 && n <= 2799) {
    // VAT, payroll, social fees — operating liabilities
    return {
      classification: "operating_liabilities",
      confidence: "medium",
      reviewReasonSv: null,
    };
  }
  if (n >= 2800 && n <= 2899) {
    // Other short-term liabilities — could be short-term loans.
    return {
      classification: "short_term_interest_bearing_loans",
      confidence: "low",
      reviewReasonSv:
        "Övriga kortfristiga skulder — bekräfta om beloppet är räntebärande lån eller rörelseskuld.",
    };
  }
  if (n >= 2900 && n <= 2999) {
    return {
      classification: "operating_liabilities",
      confidence: "high",
      reviewReasonSv: null,
    };
  }

  // ── P&L accounts (3xxx-8xxx) ───────────────────────────────────────────
  // Depreciation / amortisation in 78xx is the classic non-cash adjustment.
  if (n >= 7800 && n <= 7899) {
    return {
      classification: "non_cash_adjustment",
      confidence: "high",
      reviewReasonSv: null,
    };
  }
  // 89xx tax expense
  if (n >= 8900 && n <= 8999) {
    return {
      classification: "tax",
      confidence: "high",
      reviewReasonSv: null,
    };
  }
  // Other P&L accounts are not directly used in indirect-method derivation —
  // exclude them from the per-account engine.
  if (n >= 3000 && n <= 8999) {
    return {
      classification: "exclude",
      confidence: "high",
      reviewReasonSv: null,
    };
  }

  void accountName; // reserved for keyword-based refinement

  return {
    classification: "other_unclear",
    confidence: "low",
    reviewReasonSv: "Konto behöver klassificeras",
  };
}
