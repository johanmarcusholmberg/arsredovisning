import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  A4_WIDTH_MM,
  A4_HEIGHT_MM,
  PAGE_MARGIN_TOP_MM,
  PAGE_MARGIN_BOTTOM_MM,
  PAGE_MARGIN_LEFT_MM,
  PAGE_MARGIN_RIGHT_MM,
} from "@workspace/export-contract";

/**
 * A single A4 "page" rendered to screen.
 *
 * Width is locked to A4 (210mm); height grows with content (no hard page
 * breaks in the preview — those are computed on the server during PDF
 * rendering). Margins are read directly from `@workspace/export-contract`
 * so the on-screen layout stays in lockstep with the PDF and Word output.
 */
export function A4Page({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative bg-white text-neutral-900 shadow-sm border border-neutral-200 mx-auto",
        "print:shadow-none print:border-0",
        className,
      )}
      style={{
        width: `${A4_WIDTH_MM}mm`,
        minHeight: `${A4_HEIGHT_MM}mm`,
        paddingTop: `${PAGE_MARGIN_TOP_MM}mm`,
        paddingBottom: `${PAGE_MARGIN_BOTTOM_MM}mm`,
        paddingLeft: `${PAGE_MARGIN_LEFT_MM}mm`,
        paddingRight: `${PAGE_MARGIN_RIGHT_MM}mm`,
      }}
      data-testid="a4-page"
    >
      {children}
    </section>
  );
}
