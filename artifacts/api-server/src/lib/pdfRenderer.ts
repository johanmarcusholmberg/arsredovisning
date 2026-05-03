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
import { PDFDocument as PDFLibDocument } from "pdf-lib";
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

/**
 * Optional pre-resolved cover-sheet override. The route layer fetches the
 * uploaded file's bytes from storage when `data.cover.mode === "uploaded"`
 * and passes them in here so the renderer can splice them into the output.
 *
 * Supported `mimeType` values:
 *   - "application/pdf"  → first page of the PDF is prepended via pdf-lib
 *   - "image/png" | "image/jpeg" → drawn full-page on the cover page
 *
 * Other MIME types are ignored and the auto-generated cover is used.
 */
export interface CoverOverride {
  bytes: Buffer;
  mimeType: string;
}

// ---------------------------------------------------------------------------
// Public renderer
// ---------------------------------------------------------------------------

/**
 * Result of rendering. `coverMerged` is the *renderer-confirmed* truth of
 * whether the supplied `CoverOverride` was actually spliced/embedded into
 * the output. The route uses this to decide whether to emit
 * `export.cover_merged` — never infer the answer from "did we pass an
 * override?", because some override paths (image decode failure, unsupported
 * MIME) silently fall back to the auto cover.
 */
export interface RenderPdfResult {
  bytes: Buffer;
  coverMerged: boolean;
}

export async function renderAnnualReportPdf(
  data: AnnualReportExportData,
  coverOverride: CoverOverride | null = null,
): Promise<RenderPdfResult> {
  const isImageOverride =
    coverOverride !== null &&
    (coverOverride.mimeType === "image/png" ||
      coverOverride.mimeType === "image/jpeg" ||
      coverOverride.mimeType === "image/jpg");
  const isPdfOverride =
    coverOverride !== null && coverOverride.mimeType === "application/pdf";
  // Tracks whether the override actually made it into the output. Mutated
  // by the cover render block (image decode fallback flips it back to
  // false) and by the post-process pdf-lib splice (only true on success).
  let coverMerged = false;
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
  // Three modes:
  //   1. PDF override   → render an empty cover page (post-processed below
  //                        with pdf-lib to splice in the uploaded first page).
  //                        We still emit a placeholder page so subsequent
  //                        page-number arithmetic stays consistent until we
  //                        replace it; pdf-lib will substitute it at the end.
  //   2. Image override → fill the whole cover page with the uploaded image.
  //   3. Default        → auto-generated typographic cover.
  if (isPdfOverride) {
    // Placeholder page; will be removed and replaced with the uploaded
    // first page during the post-processing pass.
    doc.font("Helvetica").fontSize(1).text(" ", { align: "center" });
  } else if (isImageOverride && coverOverride) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    try {
      doc.image(coverOverride.bytes, 0, 0, {
        fit: [pageWidth, pageHeight],
        align: "center",
        valign: "center",
      });
      coverMerged = true;
    } catch {
      // Fall back to the auto cover if pdfkit cannot decode the image
      // (e.g. malformed PNG). Better than crashing the export.
      // coverMerged stays false so the route does NOT emit
      // `export.cover_merged` for this case.
      renderCover(doc, data);
    }
  } else {
    renderCover(doc, data);
  }

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
  let outBytes = Buffer.concat(chunks);

  // ── PDF cover splice ───────────────────────────────────────────────────
  // For an uploaded PDF cover, replace the placeholder cover page (page 0)
  // with the first page of the uploaded PDF using pdf-lib. Done as a
  // post-processing pass so we don't have to re-implement pdfkit's text /
  // table rendering on top of pdf-lib.
  if (isPdfOverride && coverOverride) {
    try {
      const [target, source] = await Promise.all([
        PDFLibDocument.load(outBytes),
        PDFLibDocument.load(coverOverride.bytes),
      ]);
      if (source.getPageCount() > 0) {
        const [copiedCover] = await target.copyPages(source, [0]);
        target.insertPage(0, copiedCover);
        // Drop the placeholder page we emitted in pdfkit (now at index 1).
        if (target.getPageCount() > 1) {
          target.removePage(1);
        }
        outBytes = Buffer.from(await target.save({ useObjectStreams: false }));
        coverMerged = true;
      }
      // If the source PDF has zero pages (effectively impossible but
      // defensible), we leave the placeholder in place and report
      // coverMerged=false. The export still succeeds.
    } catch {
      // Splicing failed (corrupt upload, encrypted PDF, etc.). Surface
      // as a render error so the route can emit EXPORT_FAILED rather
      // than silently delivering a document with a blank first page.
      throw new Error("cover_pdf_splice_failed");
    }
  }

  return { bytes: outBytes, coverMerged };
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
