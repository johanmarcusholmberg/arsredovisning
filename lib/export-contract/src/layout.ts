/**
 * Shared A4 layout constants used by the preview (CSS pixels) and by the
 * PDF/Word renderers (points / twips). Keeping a single set of nominal
 * millimetre values guarantees that the on-screen preview and the printed
 * PDF have identical column positions, margins, and pagination.
 */

// Page geometry (millimetres) ------------------------------------------------
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PAGE_MARGIN_TOP_MM = 22;
export const PAGE_MARGIN_BOTTOM_MM = 22;
export const PAGE_MARGIN_LEFT_MM = 22;
export const PAGE_MARGIN_RIGHT_MM = 18;

// Conversion helpers ---------------------------------------------------------
/** Convert millimetres to PDF points (1 pt = 1/72 in, 1 in = 25.4 mm). */
export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}
/** Convert millimetres to CSS pixels at 96 dpi. */
export function mmToPx(mm: number): number {
  return (mm * 96) / 25.4;
}
/** Convert millimetres to Word twips (1 twip = 1/1440 in, 1 in = 25.4 mm). */
export function mmToTwip(mm: number): number {
  return Math.round((mm * 1440) / 25.4);
}

// Typography -----------------------------------------------------------------
export const BODY_FONT_FAMILY = "Helvetica, Arial, sans-serif";
export const BODY_FONT_SIZE_PT = 10;
export const HEADING_FONT_SIZE_PT = 14;
export const COVER_TITLE_FONT_SIZE_PT = 28;

// Column widths for statement tables (relative weights summing to 100) -------
export const STATEMENT_COL_WEIGHTS = {
  label: 50,
  noteRef: 8,
  currentYear: 21,
  previousYear: 21,
} as const;

// Watermark ------------------------------------------------------------------
export const WATERMARK_TEXT_SV = "DEMO – EJ FÖR INLÄMNING";
export const WATERMARK_REASON_TEXT_SV: Record<"demo" | "unpaid", string> = {
  demo: "Demoprojekt — exporten är endast för utvärdering.",
  unpaid: "Ingen betalning registrerad — exporten är endast ett utkast.",
};
