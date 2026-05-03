/**
 * Phase 8 regression tests — cover-sheet merging into PDF/Word exports.
 *
 * Self-contained renderer-level checks that lock in the architect's Phase 8
 * verdict. They build a minimal `AnnualReportExportData` fixture in memory,
 * generate real input bytes (a 1x1 PNG, a 1-page PDF) with `pdf-lib`, then
 * assert that:
 *
 *   1. PDF renderer + image override  → coverMerged=true,  valid PDF output
 *   2. PDF renderer + PDF   override  → coverMerged=true,  valid PDF output
 *   3. PDF renderer + malformed image → coverMerged=false (silent fallback)
 *   4. PDF renderer + malformed PDF   → throws "cover_pdf_splice_failed"
 *   5. Word renderer + image override → coverMerged=true,  valid .docx (PK)
 *   6. Word renderer + PDF   override → coverMerged=false, valid .docx (PK)
 *   7. Word renderer + no    override → coverMerged=false, valid .docx (PK)
 *
 * Run via: `pnpm --filter @workspace/api-server run check-phase8-regressions`
 *
 * Does NOT touch the database, network, or supabase. Pure renderer I/O.
 */

import { PDFDocument as PDFLibDocument } from "pdf-lib";
import type { AnnualReportExportData } from "@workspace/export-contract";
import {
  renderAnnualReportPdf,
  type CoverOverride,
} from "../src/lib/pdfRenderer.js";
import {
  renderAnnualReportWord,
  type WordCoverOverride,
} from "../src/lib/wordRenderer.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildFixture(): AnnualReportExportData {
  return {
    schemaVersion: 1,
    generatedAt: new Date("2026-01-15T00:00:00Z").toISOString(),
    projectId: "phase8-test-project",
    reportId: "phase8-test-report",
    cover: {
      mode: "uploaded",
      title: "Årsredovisning",
      subtitle: "Räkenskapsåret 2024",
      logoUrl: null,
      uploadedFileId: "phase8-fake-file-id",
      uploadedFileUrl: null,
    },
    company: {
      id: "phase8-co",
      name: "Phase 8 Test AB",
      organizationNumber: "556677-8899",
      registeredAddress: "Testgatan 1, 111 22 Stockholm",
      framework: "K2",
    },
    period: {
      start: "2024-01-01",
      end: "2024-12-31",
      label: "Räkenskapsåret 2024",
      comparativeLabel: "Räkenskapsåret 2023",
    },
    managementReport: {
      sections: [
        {
          heading: "Verksamheten",
          paragraphs: ["Bolaget bedriver testverksamhet."],
        },
      ],
      multiYearOverview: null,
    },
    statements: [
      {
        type: "income_statement",
        heading: "Resultaträkning",
        lines: [
          {
            id: "l1",
            lineKey: "net_sales",
            label: "Nettoomsättning",
            currentYearAmount: 1000,
            previousYearAmount: 800,
            isHeading: false,
            isSubtotal: false,
            isTotal: false,
            noteReferenceText: null,
            sortOrder: 1,
          },
        ],
      },
    ],
    notes: [],
    signatures: [],
    watermark: { show: false, reason: null, text: "" },
  };
}

/** Minimal valid 1x1 JPEG (white pixel). pdfkit's JPEG decoder handles
 *  this reliably across versions; uploaded covers in practice are JPEG/PNG
 *  photos, not synthetic micro-PNGs. */
const ONE_PIXEL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHR" +
    "ofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgy" +
    "IRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMj" +
    "L/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL" +
    "/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0f" +
    "AkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1" +
    "dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1N" +
    "XW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==",
  "base64",
);

async function buildOnePagePdf(): Promise<Buffer> {
  const doc = await PDFLibDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  page.drawText("Phase 8 cover", { x: 50, y: 750, size: 24 });
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function isPdf(b: Buffer) {
  return b.length > 4 && b.slice(0, 4).toString("ascii") === "%PDF";
}
function isDocx(b: Buffer) {
  // .docx is a zip — first two bytes are "PK".
  return b.length > 2 && b[0] === 0x50 && b[1] === 0x4b;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function run() {
  const data = buildFixture();
  const pdfCover = await buildOnePagePdf();
  const malformed = Buffer.from("this is definitely not a real image or pdf");

  console.log("Phase 8 renderer regressions");

  // 1. PDF + image override → coverMerged=true
  {
    const override: CoverOverride = {
      bytes: ONE_PIXEL_JPEG,
      mimeType: "image/jpeg",
    };
    const r = await renderAnnualReportPdf(data, override);
    check(
      "PDF renderer embeds image cover (coverMerged=true, valid PDF)",
      r.coverMerged === true && isPdf(r.bytes),
      `coverMerged=${r.coverMerged} bytes=${r.bytes.length}`,
    );
    // Round-trip: should parse and have at least 1 page.
    const parsed = await PDFLibDocument.load(r.bytes);
    check(
      "PDF renderer image-override output is parseable",
      parsed.getPageCount() >= 1,
      `pageCount=${parsed.getPageCount()}`,
    );
  }

  // 2. PDF + PDF override → coverMerged=true, splice succeeded
  {
    const override: CoverOverride = {
      bytes: pdfCover,
      mimeType: "application/pdf",
    };
    const r = await renderAnnualReportPdf(data, override);
    check(
      "PDF renderer splices PDF cover (coverMerged=true, valid PDF)",
      r.coverMerged === true && isPdf(r.bytes),
      `coverMerged=${r.coverMerged} bytes=${r.bytes.length}`,
    );
    const parsed = await PDFLibDocument.load(r.bytes);
    check(
      "PDF renderer PDF-override output has the spliced first page",
      parsed.getPageCount() >= 1,
      `pageCount=${parsed.getPageCount()}`,
    );
  }

  // 3. PDF + malformed image override → does NOT throw, coverMerged=false
  {
    const override: CoverOverride = {
      bytes: malformed,
      mimeType: "image/png",
    };
    let threw: unknown = null;
    let result: { coverMerged: boolean; bytes: Buffer } | null = null;
    try {
      result = await renderAnnualReportPdf(data, override);
    } catch (err) {
      threw = err;
    }
    check(
      "PDF renderer falls back silently on malformed image (no throw, coverMerged=false)",
      threw === null && result !== null && result.coverMerged === false && isPdf(result.bytes),
      `threw=${threw ? (threw as Error).message : "no"} coverMerged=${result?.coverMerged}`,
    );
  }

  // 4. PDF + malformed PDF override → throws "cover_pdf_splice_failed"
  {
    const override: CoverOverride = {
      bytes: malformed,
      mimeType: "application/pdf",
    };
    let threw: Error | null = null;
    try {
      await renderAnnualReportPdf(data, override);
    } catch (err) {
      threw = err as Error;
    }
    check(
      "PDF renderer throws cover_pdf_splice_failed on malformed PDF override",
      threw !== null && threw.message === "cover_pdf_splice_failed",
      `threw=${threw?.message ?? "no"}`,
    );
  }

  // 5. Word + image override → coverMerged=true, valid .docx
  {
    const override: WordCoverOverride = {
      bytes: ONE_PIXEL_JPEG,
      mimeType: "image/jpeg",
    };
    const r = await renderAnnualReportWord(data, override);
    check(
      "Word renderer embeds image cover (coverMerged=true, valid .docx)",
      r.coverMerged === true && isDocx(r.bytes),
      `coverMerged=${r.coverMerged} bytes=${r.bytes.length}`,
    );
  }

  // 6. Word + PDF override → coverMerged=false (always), valid .docx
  {
    const override: WordCoverOverride = {
      bytes: pdfCover,
      mimeType: "application/pdf",
    };
    const r = await renderAnnualReportWord(data, override);
    check(
      "Word renderer never marks PDF override as merged (coverMerged=false)",
      r.coverMerged === false && isDocx(r.bytes),
      `coverMerged=${r.coverMerged} bytes=${r.bytes.length}`,
    );
  }

  // 7. Word + no override → coverMerged=false, valid .docx
  {
    const r = await renderAnnualReportWord(data, null);
    check(
      "Word renderer with no override (coverMerged=false, valid .docx)",
      r.coverMerged === false && isDocx(r.bytes),
      `coverMerged=${r.coverMerged} bytes=${r.bytes.length}`,
    );
  }

  if (failures > 0) {
    console.error(`\n${failures} Phase 8 regression(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll Phase 8 renderer regressions passed.");
}

run().catch((err) => {
  console.error("Unexpected error in Phase 8 regression run:", err);
  process.exit(1);
});
