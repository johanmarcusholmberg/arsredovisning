/**
 * Central compliance / rules config — Swedish annual report.
 *
 * Currently exposes the size thresholds used to determine whether a company
 * is a "större företag" under årsredovisningslagen (ÅRL 1 kap. 3§). The
 * thresholds are checked over the two most recent fiscal years and a
 * company is "större" when more than one of the three is exceeded for each
 * of those years (or it is listed on a regulated market).
 *
 * NEVER inline these values elsewhere — import from here.
 */

export interface SizeThresholds {
  /** Average number of employees. */
  employees: number;
  /** Balance sheet total in SEK. */
  balanceTotal: number;
  /** Net revenue in SEK. */
  netRevenue: number;
}

export const SIZE_THRESHOLDS: SizeThresholds = {
  employees: 50,
  balanceTotal: 40_000_000,
  netRevenue: 80_000_000,
};

/**
 * Tolerance (SEK) used when reconciling rounded amounts in the cash flow
 * statement against the balance sheet. Matches the rest of the validation
 * engine which uses 1 SEK as a rounding tolerance.
 */
export const CASH_FLOW_RECONCILIATION_TOLERANCE_SEK = 1;
