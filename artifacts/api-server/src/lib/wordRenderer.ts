/**
 * Server-side Word (.docx) renderer for the Swedish årsredovisning.
 *
 * Uses the `docx` package which produces a real Office Open XML document.
 * Like the PDF renderer, this consumes a fully built
 * `AnnualReportExportData` snapshot and produces a Node `Buffer`.
 *
 * Page geometry, margins, and header text mirror the PDF renderer so the
 * three surfaces (preview, PDF, Word) are visually equivalent.
 */

import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  TextRun,
  PageOrientation,
  Header,
  Footer,
  PageNumber,
  BorderStyle,
} from "docx";
import {
  type AnnualReportExportData,
  type RenderedNote,
  type FinancialStatement,
  formatSEK,
  formatSwedishDate,
  mmToTwip,
  PAGE_MARGIN_TOP_MM,
  PAGE_MARGIN_BOTTOM_MM,
  PAGE_MARGIN_LEFT_MM,
  PAGE_MARGIN_RIGHT_MM,
} from "@workspace/export-contract";

export async function renderAnnualReportWord(
  data: AnnualReportExportData,
): Promise<Buffer> {
  const cover = buildCover(data);
  const management = buildManagementReport(data);
  const statements = data.statements.flatMap((s) => buildStatement(s, data));
  const notes = buildNotes(data);
  const signatures = buildSignatures(data);

  const watermarkParagraphs = data.watermark.show
    ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: data.watermark.text,
              bold: true,
              color: "DC2626",
              size: 36,
            }),
          ],
        }),
      ]
    : [];

  const doc = new Document({
    creator: "Årsredovisningar",
    title: data.cover.title,
    description: `Årsredovisning för ${data.company.name}`,
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: {
              top: mmToTwip(PAGE_MARGIN_TOP_MM),
              bottom: mmToTwip(PAGE_MARGIN_BOTTOM_MM),
              left: mmToTwip(PAGE_MARGIN_LEFT_MM),
              right: mmToTwip(PAGE_MARGIN_RIGHT_MM),
            },
          },
        },
        headers: {
          default: new Header({
            children: watermarkParagraphs,
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${data.company.name} · ${data.period.label} · sida `,
                    size: 16,
                    color: "666666",
                  }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "666666" }),
                  new TextRun({ text: " / ", size: 16, color: "666666" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "666666" }),
                ],
              }),
            ],
          }),
        },
        children: [...cover, ...management, ...statements, ...notes, ...signatures],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function buildCover(data: AnnualReportExportData): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1800, after: 240 },
      children: [new TextRun({ text: data.cover.title, bold: true, size: 56 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: data.cover.subtitle, size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 720, after: 120 },
      children: [new TextRun({ text: data.company.name, bold: true, size: 36 })],
    }),
    ...(data.company.organizationNumber
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Org.nr ${data.company.organizationNumber}`,
                size: 22,
              }),
            ],
          }),
        ]
      : []),
    ...(data.company.registeredAddress
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: data.company.registeredAddress, size: 20 })],
          }),
        ]
      : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 720 },
      children: [new TextRun({ text: data.period.label, italics: true, size: 18 })],
      pageBreakBefore: false,
    }),
    new Paragraph({ children: [], pageBreakBefore: true }),
  ];
}

function buildManagementReport(data: AnnualReportExportData): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Förvaltningsberättelse", bold: true })],
    }),
  ];
  for (const section of data.managementReport.sections) {
    out.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: section.heading, bold: true })],
      }),
    );
    for (const p of section.paragraphs) {
      out.push(new Paragraph({ children: [new TextRun({ text: p })] }));
    }
  }
  return out;
}

function buildStatement(
  stmt: FinancialStatement,
  data: AnnualReportExportData,
): Array<Paragraph | Table> {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell("Post", { bold: true, width: 50 }),
      cell("Not", { bold: true, width: 8, align: AlignmentType.CENTER }),
      cell(data.period.label, { bold: true, width: 21, align: AlignmentType.RIGHT }),
      cell(data.period.comparativeLabel ?? "", {
        bold: true,
        width: 21,
        align: AlignmentType.RIGHT,
      }),
    ],
  });

  const rows = [headerRow];
  for (const line of stmt.lines) {
    rows.push(
      new TableRow({
        children: [
          cell(line.label, {
            bold: line.isHeading || line.isTotal,
            width: 50,
          }),
          cell(line.noteReferenceText ?? "", { width: 8, align: AlignmentType.CENTER }),
          cell(formatSEK(line.currentYearAmount), {
            bold: line.isTotal,
            width: 21,
            align: AlignmentType.RIGHT,
            topBorder: line.isTotal || line.isSubtotal,
          }),
          cell(formatSEK(line.previousYearAmount), {
            bold: line.isTotal,
            width: 21,
            align: AlignmentType.RIGHT,
            topBorder: line.isTotal || line.isSubtotal,
          }),
        ],
      }),
    );
  }

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      children: [new TextRun({ text: stmt.heading, bold: true })],
    }),
    new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
  ];
}

function buildNotes(data: AnnualReportExportData): Array<Paragraph | Table> {
  if (data.notes.length === 0) return [];
  const out: Array<Paragraph | Table> = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      children: [new TextRun({ text: "Noter", bold: true })],
    }),
  ];
  for (const note of data.notes) {
    out.push(...buildNote(note));
  }
  return out;
}

function buildNote(note: RenderedNote): Array<Paragraph | Table> {
  const numberPart = note.noteNumber !== null ? `Not ${note.noteNumber}. ` : "";
  const out: Array<Paragraph | Table> = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: `${numberPart}${note.title}`, bold: true })],
    }),
  ];
  if (note.text) {
    out.push(new Paragraph({ children: [new TextRun({ text: note.text })] }));
  }
  if (note.rows.length > 0) {
    const rows = note.rows.map(
      (r) =>
        new TableRow({
          children: [
            cell(r.label, { bold: r.isSubtotal, width: 60 }),
            cell(formatSEK(r.currentYearAmount), {
              bold: r.isSubtotal,
              width: 20,
              align: AlignmentType.RIGHT,
              topBorder: r.isSubtotal,
            }),
            cell(formatSEK(r.previousYearAmount), {
              bold: r.isSubtotal,
              width: 20,
              align: AlignmentType.RIGHT,
              topBorder: r.isSubtotal,
            }),
          ],
        }),
    );
    out.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  }
  return out;
}

function buildSignatures(data: AnnualReportExportData): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      children: [new TextRun({ text: "Underskrifter", bold: true })],
    }),
  ];
  if (data.signatures.length === 0) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Underskrifter fylls i innan inlämning. Lägg till styrelseledamöter och eventuell revisor i appen.",
            italics: true,
          }),
        ],
      }),
    );
    return out;
  }
  for (const sig of data.signatures) {
    out.push(
      new Paragraph({
        spacing: { before: 480 },
        children: [new TextRun({ text: "__________________________" })],
      }),
      new Paragraph({ children: [new TextRun({ text: sig.name, bold: true })] }),
      new Paragraph({ children: [new TextRun({ text: sig.role, italics: true })] }),
    );
    if (sig.location || sig.signedDate) {
      out.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${sig.location ?? ""}${
                sig.location && sig.signedDate ? " · " : ""
              }${sig.signedDate ? formatSwedishDate(sig.signedDate) : ""}`,
              size: 18,
              color: "666666",
            }),
          ],
        }),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cell helper
// ---------------------------------------------------------------------------

interface CellOpts {
  bold?: boolean;
  width: number;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  topBorder?: boolean;
}

function cell(text: string, opts: CellOpts): TableCell {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return new TableCell({
    width: { size: opts.width, type: WidthType.PERCENTAGE },
    borders: {
      top: opts.topBorder
        ? { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" }
        : noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
    },
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [new TextRun({ text, bold: opts.bold })],
      }),
    ],
  });
}
