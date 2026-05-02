/**
 * Renders the entire Swedish annual report (preview surface).
 *
 * Reads exclusively from `AnnualReportExportData` — no extra DB calls. This
 * is intentionally aligned with the PDF and Word renderers so what users
 * see on screen is what they get on download.
 */

import {
  type AnnualReportExportData,
  type FinancialStatement,
  type RenderedNote,
  formatSEK,
  formatSwedishDate,
} from "@workspace/export-contract";
import { A4Page } from "./A4Page";
import { Watermark } from "./Watermark";
import { cn } from "@/lib/utils";

export function AnnualReportDocument({ data }: { data: AnnualReportExportData }) {
  return (
    <div className="flex flex-col gap-6 py-6" data-testid="annual-report-document">
      <CoverPage data={data} />
      <ManagementReportPage data={data} />
      {data.statements.map((s) => (
        <StatementPage key={s.type} data={data} statement={s} />
      ))}
      {data.notes.length > 0 && <NotesPage data={data} notes={data.notes} />}
      <SignaturePage data={data} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

function CoverPage({ data }: { data: AnnualReportExportData }) {
  const { cover, company, period, watermark } = data;
  return (
    <A4Page>
      {watermark.show && <Watermark text={watermark.text} />}
      <div className="flex flex-col items-center text-center pt-32">
        {cover.logoUrl && (
          <img
            src={cover.logoUrl}
            alt=""
            className="mb-8 max-h-32 object-contain"
          />
        )}
        <h1 className="text-4xl font-bold mb-3">{cover.title}</h1>
        <p className="text-xl text-neutral-700 mb-12">{cover.subtitle}</p>
        <p className="text-2xl font-semibold">{company.name}</p>
        {company.organizationNumber && (
          <p className="mt-2 text-neutral-700">
            Org.nr {company.organizationNumber}
          </p>
        )}
        {company.registeredAddress && (
          <p className="mt-1 text-neutral-600">{company.registeredAddress}</p>
        )}
        <p className="mt-16 italic text-sm text-neutral-500">{period.label}</p>
      </div>
      <Footer data={data} pageNumber={1} />
    </A4Page>
  );
}

// ---------------------------------------------------------------------------
// Förvaltningsberättelse
// ---------------------------------------------------------------------------

function ManagementReportPage({ data }: { data: AnnualReportExportData }) {
  return (
    <A4Page>
      {data.watermark.show && <Watermark text={data.watermark.text} />}
      <h2 className="text-2xl font-bold mb-6">Förvaltningsberättelse</h2>
      {data.managementReport.sections.map((section, i) => (
        <div key={i} className="mb-6">
          <h3 className="text-lg font-semibold mb-2">{section.heading}</h3>
          {section.paragraphs.map((p, j) => (
            <p key={j} className="text-sm leading-relaxed mb-2 text-justify">
              {p}
            </p>
          ))}
        </div>
      ))}
      <Footer data={data} pageNumber={2} />
    </A4Page>
  );
}

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

function StatementPage({
  data,
  statement,
}: {
  data: AnnualReportExportData;
  statement: FinancialStatement;
}) {
  return (
    <A4Page>
      {data.watermark.show && <Watermark text={data.watermark.text} />}
      <h2 className="text-2xl font-bold mb-4">{statement.heading}</h2>
      <table className="w-full text-sm" data-testid={`statement-table-${statement.type}`}>
        <thead>
          <tr className="border-b border-neutral-400 text-xs uppercase tracking-wide text-neutral-600">
            <th className="text-left py-2 w-1/2">Post</th>
            <th className="text-center py-2 w-12">Not</th>
            <th className="text-right py-2">{data.period.label}</th>
            {data.period.comparativeLabel && (
              <th className="text-right py-2">{data.period.comparativeLabel}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {statement.lines.map((line) => (
            <tr
              key={line.id}
              className={cn(
                "border-b border-neutral-100",
                line.isTotal && "border-t-2 border-t-neutral-900 font-semibold",
                line.isSubtotal && "border-t border-t-neutral-300 font-medium",
                line.isHeading && "font-semibold text-neutral-900",
              )}
            >
              <td className={cn("py-1", line.isHeading && "text-base pt-3")}>
                {line.label}
              </td>
              <td className="py-1 text-center text-xs text-neutral-600">
                {line.noteReferenceText ?? ""}
              </td>
              <td className="py-1 text-right tabular-nums">
                {formatSEK(line.currentYearAmount)}
              </td>
              {data.period.comparativeLabel && (
                <td className="py-1 text-right tabular-nums">
                  {formatSEK(line.previousYearAmount)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <Footer data={data} pageNumber={null} />
    </A4Page>
  );
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

function NotesPage({
  data,
  notes,
}: {
  data: AnnualReportExportData;
  notes: RenderedNote[];
}) {
  return (
    <A4Page>
      {data.watermark.show && <Watermark text={data.watermark.text} />}
      <h2 className="text-2xl font-bold mb-4">Noter</h2>
      {notes.map((n) => (
        <NoteBlock key={n.id} note={n} period={data.period} />
      ))}
      <Footer data={data} pageNumber={null} />
    </A4Page>
  );
}

function NoteBlock({
  note,
  period,
}: {
  note: RenderedNote;
  period: AnnualReportExportData["period"];
}) {
  return (
    <div className="mb-5" data-testid={`note-${note.noteNumber ?? "x"}`}>
      <h3 className="text-base font-semibold mb-1">
        {note.noteNumber !== null && (
          <span className="text-neutral-700">Not {note.noteNumber}. </span>
        )}
        {note.title}
      </h3>
      {note.text && (
        <p className="text-sm leading-relaxed text-justify mb-2 whitespace-pre-line">
          {note.text}
        </p>
      )}
      {note.rows.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-xs text-neutral-600">
              <th className="text-left py-1 w-3/5"></th>
              <th className="text-right py-1">{period.label}</th>
              {period.comparativeLabel && (
                <th className="text-right py-1">{period.comparativeLabel}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {note.rows.map((r) => (
              <tr
                key={r.id}
                className={cn(
                  "border-b border-neutral-100",
                  r.isSubtotal && "border-t border-t-neutral-400 font-semibold",
                )}
              >
                <td className="py-0.5">{r.label}</td>
                <td className="py-0.5 text-right tabular-nums">
                  {formatSEK(r.currentYearAmount)}
                </td>
                {period.comparativeLabel && (
                  <td className="py-0.5 text-right tabular-nums">
                    {formatSEK(r.previousYearAmount)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

function SignaturePage({ data }: { data: AnnualReportExportData }) {
  return (
    <A4Page>
      {data.watermark.show && <Watermark text={data.watermark.text} />}
      <h2 className="text-2xl font-bold mb-6">Underskrifter</h2>
      {data.signatures.length === 0 ? (
        <p className="italic text-sm text-neutral-600">
          Underskrifter fylls i innan inlämning. Lägg till styrelseledamöter och
          eventuell revisor i appen.
        </p>
      ) : (
        <div className="space-y-10">
          {data.signatures.map((s, i) => (
            <div key={i} className="text-sm">
              <div className="border-b border-neutral-400 mb-2 h-6"></div>
              <p className="font-semibold">{s.name}</p>
              <p className="italic text-neutral-600">{s.role}</p>
              {(s.location || s.signedDate) && (
                <p className="text-xs text-neutral-500">
                  {s.location}
                  {s.location && s.signedDate ? " · " : ""}
                  {s.signedDate ? formatSwedishDate(s.signedDate) : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <Footer data={data} pageNumber={null} />
    </A4Page>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer({
  data,
  pageNumber,
}: {
  data: AnnualReportExportData;
  pageNumber: number | null;
}) {
  return (
    <div className="absolute bottom-6 left-[20mm] right-[20mm] text-center text-[10px] text-neutral-500 border-t border-neutral-200 pt-2">
      {data.company.name} · {data.period.label}
      {pageNumber !== null && ` · sida ${pageNumber}`}
    </div>
  );
}
