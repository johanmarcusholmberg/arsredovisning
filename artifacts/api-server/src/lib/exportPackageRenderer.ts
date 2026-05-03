/**
 * Appendix renderers for export packages (Phase 7, step 6).
 *
 * Two simple PDF appendices the user may opt into when exporting:
 *
 *   1. Validation summary  — a per-issue list of the readiness verdict
 *      that produced this export (blocking / warning / info).
 *   2. Audit / change summary — the chronological list of meaningful
 *      project events leading up to the export.
 *
 * Both appendices are *separate files* attached to the same export package
 * (linked by `packageId` in `export_files`). The formal annual report PDF
 * and Word file never contain these unless the user explicitly opts in.
 *
 * The appendices intentionally use the same restrained black/grey/white
 * style as the main PDF so a printed package looks coherent.
 */

import PDFDocument from "pdfkit";
import {
  formatSwedishDate,
  mmToPt,
  PAGE_MARGIN_TOP_MM,
  PAGE_MARGIN_BOTTOM_MM,
  PAGE_MARGIN_LEFT_MM,
  PAGE_MARGIN_RIGHT_MM,
  type ExportReadiness,
} from "@workspace/export-contract";

interface AuditRow {
  createdAt: Date;
  eventType: string;
  actorProfileId: string | null;
  eventData: unknown;
}

const MARGINS = {
  top: mmToPt(PAGE_MARGIN_TOP_MM),
  bottom: mmToPt(PAGE_MARGIN_BOTTOM_MM),
  left: mmToPt(PAGE_MARGIN_LEFT_MM),
  right: mmToPt(PAGE_MARGIN_RIGHT_MM),
};

// ---------------------------------------------------------------------------
// Validation summary
// ---------------------------------------------------------------------------

export async function renderValidationSummaryPdf(
  readiness: ExportReadiness,
  context: { companyName: string; periodLabel: string },
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: MARGINS,
    info: {
      Title: `Valideringssammanställning – ${context.companyName}`,
      Subject: "Valideringssammanställning – bilaga",
      Producer: "Årsredovisningar",
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  doc.font("Helvetica-Bold").fontSize(18).text("Valideringssammanställning");
  doc.moveDown(0.4);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#444")
    .text(`${context.companyName} · ${context.periodLabel}`);
  doc.fillColor("#000");
  doc.moveDown(0.6);

  const verdictText = (() => {
    switch (readiness.level) {
      case "blocking":
        return "Slutgiltig export var blockerad vid genereringstillfället.";
      case "warning":
        return "Exporten genererades med varningar.";
      case "info":
        return "Exporten genererades med informationspunkter.";
      case "ok":
      default:
        return "Inga blockerande valideringsproblem hittades vid exporten.";
    }
  })();
  doc
    .font("Helvetica-Oblique")
    .fontSize(10)
    .text(verdictText);
  doc.moveDown(0.6);

  const groups: Array<{ key: ExportReadiness["level"]; label: string }> = [
    { key: "blocking", label: "Blockerande" },
    { key: "warning", label: "Varningar" },
    { key: "info", label: "Information" },
    { key: "ok", label: "Godkända kontroller" },
  ];

  for (const g of groups) {
    const items = readiness.items.filter((i) => i.level === g.key);
    if (items.length === 0) continue;
    doc.moveDown(0.4);
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(
        g.key === "blocking"
          ? "#7f1d1d"
          : g.key === "warning"
          ? "#92400e"
          : g.key === "info"
          ? "#1e3a8a"
          : "#14532d",
      )
      .text(`${g.label} (${items.length})`);
    doc.fillColor("#000");
    doc.moveDown(0.2);
    for (const it of items) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
        doc.addPage();
      }
      doc.font("Helvetica-Bold").fontSize(9).text(`• ${it.code}`);
      doc
        .font("Helvetica")
        .fontSize(9)
        .text(it.message, { indent: 12 });
      doc.moveDown(0.2);
    }
  }

  doc.end();
  await done;
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Audit / change summary
// ---------------------------------------------------------------------------

export async function renderAuditSummaryPdf(
  events: AuditRow[],
  context: { companyName: string; periodLabel: string },
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: MARGINS,
    info: {
      Title: `Ändringshistorik – ${context.companyName}`,
      Subject: "Ändringshistorik – bilaga",
      Producer: "Årsredovisningar",
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  doc.font("Helvetica-Bold").fontSize(18).text("Ändringshistorik");
  doc.moveDown(0.4);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#444")
    .text(`${context.companyName} · ${context.periodLabel}`);
  doc.fillColor("#000");
  doc.moveDown(0.4);
  doc
    .font("Helvetica-Oblique")
    .fontSize(9)
    .fillColor("#555")
    .text(
      "Sammanställning av loggade händelser i projektet fram till exporten. " +
        "Bilagan ingår endast i exportpaketet och är inte en del av den formella årsredovisningen.",
    );
  doc.fillColor("#000");
  doc.moveDown(0.6);

  if (events.length === 0) {
    doc.font("Helvetica").fontSize(10).text("Inga händelser registrerade.");
    doc.end();
    await done;
    return Buffer.concat(chunks);
  }

  const totalWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const tsW = totalWidth * 0.22;
  const eventW = totalWidth * 0.32;
  const detailW = totalWidth * 0.46;
  const startX = doc.page.margins.left;

  doc.font("Helvetica-Bold").fontSize(9);
  doc.text("Tidpunkt", startX, doc.y, { width: tsW });
  doc.text("Händelse", startX + tsW, doc.y, { width: eventW });
  doc.text("Detaljer", startX + tsW + eventW, doc.y, { width: detailW });
  doc.moveDown(0.2);
  doc
    .moveTo(startX, doc.y)
    .lineTo(startX + totalWidth, doc.y)
    .lineWidth(0.5)
    .strokeColor("#888")
    .stroke();
  doc.moveDown(0.2);

  doc.font("Helvetica").fontSize(8.5);
  for (const ev of events) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
    }
    const ry = doc.y;
    const ts = `${formatSwedishDate(ev.createdAt.toISOString())} ${ev.createdAt
      .toISOString()
      .slice(11, 16)}`;
    doc.text(ts, startX, ry, { width: tsW });
    doc.text(ev.eventType, startX + tsW, ry, { width: eventW });
    doc.text(formatEventData(ev.eventData), startX + tsW + eventW, ry, {
      width: detailW,
    });
    doc.moveDown(0.15);
  }

  doc.end();
  await done;
  return Buffer.concat(chunks);
}

function formatEventData(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = data as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "object") continue;
    const s = String(v);
    if (s.length > 60) continue;
    parts.push(`${k}=${s}`);
    if (parts.length >= 4) break;
  }
  return parts.join(" · ");
}
