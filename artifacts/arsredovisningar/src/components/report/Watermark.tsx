import { WATERMARK_TEXT_SV } from "@workspace/export-contract";

/**
 * Diagonal "DEMO – EJ FÖR INLÄMNING" watermark used on every A4 page when
 * the project is unpaid or marked as demo. Exact wording matches the PDF
 * and Word renderers.
 */
export function Watermark({ text = WATERMARK_TEXT_SV }: { text?: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      data-testid="export-watermark"
    >
      <span
        className="text-red-600/15 font-bold uppercase tracking-widest"
        style={{
          fontSize: "72px",
          transform: "rotate(-30deg)",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
    </div>
  );
}
