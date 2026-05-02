/**
 * Swedish formatting helpers used by the preview, the PDF renderer, and the
 * Word renderer. Keeping these in one place guarantees the three surfaces
 * always agree on number/date presentation.
 *
 * Conventions:
 *   - Thousands separator: U+00A0 (non-breaking space) so amounts never break
 *     across lines mid-number.
 *   - Decimal separator: comma (",")
 *   - Negative numbers use a leading hyphen-minus.
 *   - Empty / null values render as the en-dash "–".
 *   - Amounts are stored as SEK with two implicit decimals; we present them
 *     rounded to whole kronor by default (matches Swedish årsredovisning
 *     convention).
 */

const NBSP = "\u00A0";
const EN_DASH = "\u2013";

export interface FormatSEKOptions {
  /** Number of decimals to show. Defaults to 0 (whole kronor). */
  decimals?: number;
  /** Render zero as the en-dash instead of "0". Defaults to false. */
  blankZero?: boolean;
  /** Append " kr" suffix. Defaults to false (most table cells omit the unit). */
  withSuffix?: boolean;
}

/**
 * Format a SEK amount in Swedish convention. Returns the en-dash for null /
 * undefined / NaN. Rounds half-away-from-zero to the requested decimals.
 */
export function formatSEK(
  value: number | null | undefined,
  opts: FormatSEKOptions = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return EN_DASH;
  }
  const { decimals = 0, blankZero = false, withSuffix = false } = opts;
  if (blankZero && value === 0) return EN_DASH;

  const negative = value < 0;
  const abs = Math.abs(value);
  // Round half-away-from-zero
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(abs * factor) / factor;

  const fixed = rounded.toFixed(decimals); // "1234567.89"
  const [intPart, decPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const body = decPart ? `${grouped},${decPart}` : grouped;
  const signed = negative ? `-${body}` : body;
  return withSuffix ? `${signed}${NBSP}kr` : signed;
}

/**
 * Format a fiscal-year label suitable for the cover and section headings.
 * Accepts an ISO date or a plain year string. Returns "Räkenskapsåret YYYY"
 * for calendar years and "Räkenskapsåret YYYY-MM-DD – YYYY-MM-DD" for split
 * fiscal years.
 */
export function formatFiscalYearLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return `Räkenskapsåret ${start} – ${end}`;
  }
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const startsJan1 = s.getUTCMonth() === 0 && s.getUTCDate() === 1;
  const endsDec31 = e.getUTCMonth() === 11 && e.getUTCDate() === 31;
  if (sameYear && startsJan1 && endsDec31) {
    return `Räkenskapsåret ${e.getUTCFullYear()}`;
  }
  return `Räkenskapsåret ${formatSwedishDate(start)} ${EN_DASH} ${formatSwedishDate(end)}`;
}

/**
 * Format a date in Swedish ISO style (YYYY-MM-DD). Returns the input string
 * unchanged when not parseable.
 */
export function formatSwedishDate(iso: string | null | undefined): string {
  if (!iso) return EN_DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
