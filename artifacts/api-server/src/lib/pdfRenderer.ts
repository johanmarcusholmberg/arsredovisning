/**
 * Server-side PDF renderer for the Swedish årsredovisning.
 *
 * Backed by `pdfkit` so we can render entirely in-process without spawning a
 * headless browser. Layout constants come from `@workspace/export-contract`
 * to guarantee parity with the on-screen preview.
 *
 * The renderer never reaches into the database directly. It consumes a fully
 * built `AnnualReportExportData` snapshot (see `exportDataBuilder.ts`) and
 * emits a Node `Buffer` with the rendered PDF bytes.
 */

import PDFDocument from "pdfkit";
import {
  type AnnualReportExportData,
  type RenderedNote,
  type FinancialStatement,
  formatSEK,
  formatSwedishDate,
  mmToPt,
  PAGE_MARGIN_TOP_MM,
  PAGE_MARGIN_BOTTOM_MM,
  PAGE_MARGIN_LEFT_MM,
  PAGE_MARGIN_RIGHT_MM,
} from "@workspace/export-contract";

// ---------------------------------------------------------------------------
// Public renderer
// ---------------------------------------------------------------------------

export async function renderAnnualReportPdf(
  data: AnnualReportExportData,
): Promise<Buffer> {
  const margins = {
    top: mmToPt(PAGE_MARGIN_TOP_MM),
    bottom: mmToPt(PAGE_MARGIN_BOTTOM_MM),
    left: mmToPt(PAGE_MARGIN_LEFT_MM),
    right: mmToPt(PAGE_MARGIN_RIGHT_MM),
  };

  const doc = new PDFDocument({
    size: "A4",
    margins,
    info: {
      Title: data.cover.title,
      Author: data.company.name,
      Subject: "Årsredovisning",
      Producer: "Årsredovisningar",
    },
    bufferPages: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  // ── Cover ───────────────────────────────────────────────────────────────
  renderCover(doc, data);

  // ── Förvaltningsberättelse ──────────────────────────────────────────────
  doc.addPage();
  renderHeading(doc, "Förvaltningsberättelse");
  for (const section of data.managementReport.sections) {
    renderSubheading(doc, section.heading);
    for (const p of section.paragraphs) {
      doc.font("Helvetica").fontSize(10).text(p, { align: "justify" });
      doc.moveDown(0.4);
    }
    doc.moveDown(0.4);
  }

  // ── Statements ──────────────────────────────────────────────────────────
  for (const stmt of data.statements) {
    doc.addPage();
    renderStatement(doc, stmt, data);
  }

  // ── Notes ───────────────────────────────────────────────────────────────
  if (data.notes.length > 0) {
    doc.addPage();
    renderHeading(doc, "Noter");
    for (const note of data.notes) {
      renderNote(doc, note);
    }
  }

  // ── Signatures ─────────────────────────────────────────────────────────
  doc.addPage();
  renderHeading(doc, "Underskrifter");
  if (data.signatures.length === 0) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(10)
      .text(
        "Underskrifter fylls i innan inlämning. Lägg till styrelseledamöter och eventuell revisor i appen.",
      );
  } else {
    for (const sig of data.signatures) {
      doc.moveDown(2);
      doc.font("Helvetica").fontSize(10).text("__________________________");
      doc.text(`${sig.name}`);
      doc.font("Helvetica-Oblique").text(sig.role);
      if (sig.location || sig.signedDate) {
        doc.text(
          `${sig.location ?? ""}${sig.location && sig.signedDate ? " · " : ""}${
            sig.signedDate ? formatSwedishDate(sig.signedDate) : ""
          }`,
        );
      }
    }
  }

  // ── Watermark + footers (apply across all pages last) ──────────────────
  applyWatermarkAndFooters(doc, data);

  doc.end();
  await done;
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

function renderCover(doc: PDFKit.PDFDocument, data: AnnualReportExportData) {
  const { cover, company, period } = data;
  const top = mmToPt(60);
  doc.font("Helvetica-Bold").fontSize(28).text(cover.title, {
    align: "center",
    baseline: "top",
  });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(14).text(cover.subtitle, { align: "center" });
  doc.moveDown(2);
  doc.font("Helvetica-Bold").fontSize(18).text(company.name, { align: "center" });
  if (company.organizationNumber) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .text(`Org.nr ${company.organizationNumber}`, { align: "center" });
  }
  if (company.registeredAddress) {
    doc.font("Helvetica").fontSize(10).text(company.registeredAddress, { align: "center" });
  }
  doc.moveDown(3);
  doc
    .font("Helvetica-Oblique")
    .fontSize(9)
    .text(period.label, { align: "center" });
  void top;
}

// ---------------------------------------------------------------------------
// Headings
// ---------------------------------------------------------------------------

function renderHeading(doc: PDFKit.PDFDocument, text: string) {
  doc.font("Helvetica-Bold").fontSize(16).text(text);
  doc.moveDown(0.6);
}

function renderSubheading(doc: PDFKit.PDFDocument, text: string) {
  doc.font("Helvetica-Bold").fontSize(12).text(text);
  doc.moveDown(0.3);
}

// ---------------------------------------------------------------------------
// Statement table
// ---------------------------------------------------------------------------

function renderStatement(
  doc: PDFKit.PDFDocument,
  stmt: FinancialStatement,
  data: AnnualReportExportData,
) {
  renderHeading(doc, stmt.heading);

  const totalWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelW = totalWidth * 0.5;
  const noteW = totalWidth * 0.08;
  const cyW = totalWidth * 0.21;
  const pyW = totalWidth * 0.21;

  // Header row
  const startX = doc.page.margins.left;
  let y = doc.y;
  doc.font("Helvetica-Bold").fontSize(9);
  doc.text("Post", startX, y, { width: labelW });
  doc.text("Not", startX + labelW, y, { width: noteW, align: "center" });
  doc.text(data.period.label, startX + labelW + noteW, y, {
    width: cyW,
    align: "right",
  });
  if (data.period.comparativeLabel) {
    doc.text(data.period.comparativeLabel, startX + labelW + noteW + cyW, y, {
      width: pyW,
      align: "right",
    });
  }
  y = doc.y + 4;
  doc
    .moveTo(startX, y)
    .lineTo(startX + totalWidth, y)
    .strokeColor("#888")
    .lineWidth(0.5)
    .stroke();
  doc.y = y + 4;

  doc.font("Helvetica").fontSize(10);
  for (const line of stmt.lines) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
    }
    const ry = doc.y;
    const isEmphasis = line.isTotal || line.isHeading;
    doc.font(isEmphasis ? "Helvetica-Bold" : "Helvetica").fontSize(line.isHeading ? 11 : 10);
    doc.text(line.label, startX, ry, { width: labelW });
    doc.text(line.noteReferenceText ?? "", startX + labelW, ry, {
      width: noteW,
      align: "center",
    });
    doc.text(formatSEK(line.currentYearAmount), startX + labelW + noteW, ry, {
      width: cyW,
      align: "right",
    });
    doc.text(formatSEK(line.previousYearAmount), startX + labelW + noteW + cyW, ry, {
      width: pyW,
      align: "right",
    });
    if (line.isSubtotal || line.isTotal) {
      const ny = doc.y + 1;
      doc
        .moveTo(startX + labelW, ny)
        .lineTo(startX + totalWidth, ny)
        .lineWidth(line.isTotal ? 1 : 0.4)
        .strokeColor(line.isTotal ? "#222" : "#aaa")
        .stroke();
      doc.y = ny + 3;
    }
    doc.moveDown(0.1);
  }
}

// ---------------------------------------------------------------------------
// Note
// ---------------------------------------------------------------------------

function renderNote(doc: PDFKit.PDFDocument, note: RenderedNote) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 80) {
    doc.addPage();
  }
  const numberPart = note.noteNumber !== null ? `Not ${note.noteNumber}. ` : "";
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(`${numberPart}${note.title}`);
  doc.moveDown(0.2);

  if (note.text) {
    doc.font("Helvetica").fontSize(10).text(note.text, { align: "justify" });
    doc.moveDown(0.4);
  }

  if (note.rows.length > 0) {
    const totalWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const labelW = totalWidth * 0.6;
    const cyW = totalWidth * 0.2;
    const pyW = totalWidth * 0.2;
    const x = doc.page.margins.left;
    for (const row of note.rows) {
      const ry = doc.y;
      doc.font(row.isSubtotal ? "Helvetica-Bold" : "Helvetica").fontSize(10);
      doc.text(row.label, x, ry, { width: labelW });
      doc.text(formatSEK(row.currentYearAmount), x + labelW, ry, {
        width: cyW,
        align: "right",
      });
      doc.text(formatSEK(row.previousYearAmount), x + labelW + cyW, ry, {
        width: pyW,
        align: "right",
      });
      doc.moveDown(0.05);
    }
  }
  doc.moveDown(0.6);
}

// ---------------------------------------------------------------------------
// Watermark + per-page footer
// ---------------------------------------------------------------------------

function applyWatermarkAndFooters(
  doc: PDFKit.PDFDocument,
  data: AnnualReportExportData,
) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    // Footer
    doc.save();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#666")
      .text(
        `${data.company.name} · ${data.period.label} · sida ${i + 1}/${range.count}`,
        doc.page.margins.left,
        doc.page.height - mmToPt(15),
        { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: "center" },
      );
    doc.restore();

    if (data.watermark.show) {
      doc.save();
      doc.rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
      doc
        .font("Helvetica-Bold")
        .fontSize(60)
        .fillColor("#dc2626", 0.15)
        .text(data.watermark.text, 0, doc.page.height / 2 - 30, {
          width: doc.page.width,
          align: "center",
        });
      doc.restore();
    }
  }
}
