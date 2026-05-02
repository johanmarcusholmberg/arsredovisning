/**
 * Build the canonical AnnualReportExportData snapshot for a report.
 *
 * One pure read function — no writes, no audit logging, no permission checks.
 * It is the single source of truth for the on-screen preview, the PDF
 * renderer, and the Word renderer. If you need to change how something is
 * presented, change it here so all three surfaces update in lock-step.
 *
 * Reclassification math is delegated to `presentationAmounts` so this builder
 * never re-implements the netting logic.
 */

import { and, eq, asc } from "drizzle-orm";
import {
  db,
  reportsTable,
  companiesTable,
  financialStatementLinesTable,
  reportNotesTable,
  reportNoteRowsTable,
  noteStatementReferencesTable,
  annualReportProjectsTable,
} from "@workspace/db";
import {
  type AnnualReportExportData,
  type FinancialStatement,
  type StatementLine,
  type RenderedNote,
  type NoteRow,
  type CompanySnapshot,
  type FiscalPeriod,
  type ManagementReport,
  type ExportCoverSheet,
  type ExportWatermark,
  type StatementType,
  type Framework,
  formatFiscalYearLabel,
  WATERMARK_TEXT_SV,
} from "@workspace/export-contract";
import {
  getPresentedNoteRowAmounts,
  getPresentedStatementLineAdjustments,
} from "./presentationAmounts.js";
import { resolveProjectForReport } from "../helpers/projectReportLink.js";
import { isDemoProject, mustWatermark, isKnownDemoProjectId } from "../helpers/demo.js";
import { hasPaidProjectEntitlement } from "../helpers/permissions.js";

// ---------------------------------------------------------------------------
// Statement headings (Swedish)
// ---------------------------------------------------------------------------

const STATEMENT_HEADINGS: Record<StatementType, string> = {
  income_statement: "Resultaträkning",
  balance_sheet: "Balansräkning",
  cash_flow: "Kassaflödesanalys",
};

const STATEMENT_ORDER: StatementType[] = [
  "income_statement",
  "balance_sheet",
  "cash_flow",
];

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface BuildExportDataOptions {
  /** Force the watermark on/off regardless of project state. */
  forceWatermark?: boolean;
}

/**
 * Build the complete export snapshot for a report. Returns null if the report
 * does not exist.
 */
export async function buildAnnualReportExportData(
  reportId: string,
  opts: BuildExportDataOptions = {},
): Promise<AnnualReportExportData | null> {
  const [report] = await db
    .select({ report: reportsTable, company: companiesTable })
    .from(reportsTable)
    .innerJoin(companiesTable, eq(reportsTable.companyId, companiesTable.id))
    .where(eq(reportsTable.id, reportId))
    .limit(1);

  if (!report) return null;

  const link = await resolveProjectForReport(reportId);
  const projectId = link?.projectId ?? null;

  // Cover sheet & demo flag are properties of the project. Without a project
  // row we fall back to a sensible auto-cover with no watermark.
  let isDemo = false;
  let isPaid = true;
  let projectRow: typeof annualReportProjectsTable.$inferSelect | null = null;
  if (projectId) {
    const [pr] = await db
      .select()
      .from(annualReportProjectsTable)
      .where(eq(annualReportProjectsTable.id, projectId))
      .limit(1);
    projectRow = pr ?? null;
    isDemo = await isDemoProject(projectId);
    isPaid = await hasPaidProjectEntitlement(projectId);
  }

  const company: CompanySnapshot = {
    id: report.company.id,
    name: report.company.name,
    organizationNumber:
      // companies table column may be missing in schema drift — try a few
      // candidate fields safely.
      (report.company as unknown as { organizationNumber?: string })
        .organizationNumber ?? "",
    registeredAddress:
      (report.company as unknown as { registeredAddress?: string | null })
        .registeredAddress ?? null,
    framework: (report.report.accountingFramework as Framework) ?? "K3",
  };

  const period: FiscalPeriod = {
    start: report.report.fiscalYearStart,
    end: report.report.fiscalYearEnd,
    label: formatFiscalYearLabel(
      report.report.fiscalYearStart,
      report.report.fiscalYearEnd,
    ),
    comparativeLabel: previousYearLabel(report.report.fiscalYearStart),
  };

  const [statements, notes] = await Promise.all([
    buildStatements(reportId),
    buildNotes(reportId),
  ]);

  // Single-source-of-truth invariant: the renderers do not yet honor the
  // "uploaded" cover mode. Coerce it to "auto" here so every downstream
  // consumer (preview, PDF, Word, history snapshot) sees the same shape.
  const rawMode = (projectRow?.coverMode as ExportCoverSheet["mode"]) ?? "auto";
  const safeMode: ExportCoverSheet["mode"] =
    rawMode === "uploaded" ? "auto" : rawMode;
  const cover: ExportCoverSheet = {
    mode: safeMode,
    title: projectRow?.coverTitle ?? "Årsredovisning",
    subtitle: projectRow?.coverSubtitle ?? period.label,
    logoUrl: projectRow?.coverLogoUrl ?? null,
    uploadedFileId: projectRow?.coverUploadedFileId ?? null,
    uploadedFileUrl: null, // resolved at the route layer if requested
  };

  const showWm = opts.forceWatermark ?? mustWatermark(isDemo, isPaid);
  const watermark: ExportWatermark = {
    show: showWm,
    reason: !showWm ? null : isDemo ? "demo" : "unpaid",
    text: WATERMARK_TEXT_SV,
  };

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    projectId,
    reportId,
    cover,
    company,
    period,
    managementReport: buildPlaceholderManagementReport(company, period),
    statements,
    notes,
    signatures: [],
    watermark,
  };
}

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

/**
 * Build the cash flow statement section if (and only if) the project's
 * requirement assessment indicates the statement must (or should) be
 * included AND the statement has been validated. Returns null when the
 * cash flow statement should be omitted.
 */
async function buildCashFlowStatement(
  reportId: string,
): Promise<FinancialStatement | null> {
  try {
    const link = await resolveProjectForReport(reportId);
    if (!link?.projectId) return null;
    const { getOrCreateAssessment, deriveAssessmentResult, shouldIncludeCashFlow } =
      await import("./cashFlowAssessmentService.js");
    const { loadCashFlowStatement } = await import("./cashFlowStatementService.js");

    const assessment = await getOrCreateAssessment(link.projectId);
    const verdict = deriveAssessmentResult(assessment);
    const requirement =
      assessment.assessmentStatus === "manually_overridden"
        ? assessment.cashFlowRequirement
        : verdict.cashFlowRequirement;
    const include = shouldIncludeCashFlow({
      ...assessment,
      cashFlowRequirement: requirement,
    });
    if (!include) return null;

    const stmt = await loadCashFlowStatement(link.projectId);
    if (!stmt) return null;

    // Hard gate: only include a cash flow statement that has been validated.
    // Anything else (draft / needs_review / blocked) must be excluded so the
    // validation engine remains the single chokepoint that blocks export.
    if (stmt.statement.status !== "validated") return null;

    const lines: StatementLine[] = stmt.lines.map((l, idx) => ({
      id: l.id,
      lineKey: l.lineCode,
      label: l.labelSv,
      currentYearAmount:
        l.amountCurrentYear === null ? null : Number(l.amountCurrentYear),
      previousYearAmount:
        l.amountPreviousYear === null ? null : Number(l.amountPreviousYear),
      isHeading: false,
      isSubtotal: l.isSubtotal,
      isTotal: l.lineCode === "rec_closing_cash",
      noteReferenceText: null,
      sortOrder: l.sortOrder ?? idx,
    }));
    return {
      type: "cash_flow",
      heading: "Kassaflödesanalys",
      lines,
    };
  } catch {
    return null;
  }
}

async function buildStatements(reportId: string): Promise<FinancialStatement[]> {
  const lines = await db
    .select()
    .from(financialStatementLinesTable)
    .where(eq(financialStatementLinesTable.reportId, reportId))
    .orderBy(
      asc(financialStatementLinesTable.statementType),
      asc(financialStatementLinesTable.sortOrder),
    );

  // Apply presentation adjustments from active reclassifications.
  const adjustments = await getPresentedStatementLineAdjustments(reportId);

  // Resolve display labels for the "Not" column.
  const refs = await db
    .select()
    .from(noteStatementReferencesTable);
  const refByLine = new Map<string, string[]>(); // key: `${statementType}:${lineKey}`
  for (const r of refs) {
    const key = `${r.statementType}:${r.lineKey}`;
    if (!refByLine.has(key)) refByLine.set(key, []);
    if (r.displayLabel) {
      // Strip "Not " prefix so we can render "1, 4" rather than "Not 1, Not 4".
      const num = r.displayLabel.replace(/^Not\s*/i, "").trim();
      if (num) refByLine.get(key)!.push(num);
    }
  }

  const buckets: Record<StatementType, StatementLine[]> = {
    income_statement: [],
    balance_sheet: [],
    cash_flow: [],
  };

  for (const line of lines) {
    const stype = line.statementType as StatementType;
    if (!(stype in buckets)) continue;

    const cyRaw = line.currentYearAmount === null ? null : Number(line.currentYearAmount);
    const pyRaw = line.previousYearAmount === null ? null : Number(line.previousYearAmount);
    const adjEntry = adjustments.get(line.lineKey);
    const adj = adjEntry ? adjEntry.netDelta : 0;

    const refKey = `${line.statementType}:${line.lineKey}`;
    const refList = refByLine.get(refKey) ?? [];
    const noteReferenceText =
      refList.length > 0
        ? refList.join(", ")
        : line.noteReferenceText && line.noteReferenceText.trim().length > 0
        ? line.noteReferenceText.trim()
        : null;

    buckets[stype].push({
      id: line.id,
      lineKey: line.lineKey,
      label: line.swedishLabel,
      currentYearAmount: cyRaw === null ? null : cyRaw + adj,
      previousYearAmount: pyRaw,
      isHeading: line.isHeading,
      isSubtotal: line.isSubtotal,
      isTotal: line.isTotal,
      noteReferenceText,
      sortOrder: line.sortOrder,
    });
  }

  const baseStatements = STATEMENT_ORDER.filter(
    (t) => buckets[t].length > 0,
  ).map((type) => ({
    type,
    heading: STATEMENT_HEADINGS[type],
    lines: buckets[type],
  }));

  // Inject the cash flow statement (if applicable) — replaces any cash_flow
  // entry that may have been seeded from financial_statement_lines (which
  // legacy data does not populate but is defensively handled).
  const cf = await buildCashFlowStatement(reportId);
  const without = baseStatements.filter((s) => s.type !== "cash_flow");
  return cf ? [...without, cf] : without;
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

async function buildNotes(reportId: string): Promise<RenderedNote[]> {
  const notes = await db
    .select()
    .from(reportNotesTable)
    .where(eq(reportNotesTable.reportId, reportId))
    .orderBy(asc(reportNotesTable.noteNumber), asc(reportNotesTable.sortOrder));

  if (notes.length === 0) return [];

  const noteIds = notes.map((n) => n.id);
  const allRows = await db
    .select()
    .from(reportNoteRowsTable);
  const rowsByNote = new Map<string, NoteRow[]>();
  const presented = await getPresentedNoteRowAmounts(reportId);

  for (const row of allRows) {
    if (!noteIds.includes(row.noteId)) continue;
    const cy = row.currentYearAmount === null ? null : Number(row.currentYearAmount);
    const py = row.previousYearAmount === null ? null : Number(row.previousYearAmount);
    const presentedEntry = presented.get(row.id);
    const presentedCy =
      presentedEntry && presentedEntry.presentedCurrentYearAmount !== null
        ? Number(presentedEntry.presentedCurrentYearAmount)
        : null;
    if (!rowsByNote.has(row.noteId)) rowsByNote.set(row.noteId, []);
    rowsByNote.get(row.noteId)!.push({
      id: row.id,
      label: row.label,
      currentYearAmount: presentedEntry ? presentedCy : cy,
      previousYearAmount: py,
      isSubtotal: row.isSubtotal,
    });
  }

  return notes
    .filter((n) => n.status !== "not_applicable")
    .map((n): RenderedNote => {
      const rows = (rowsByNote.get(n.id) ?? []).sort((a, b) =>
        a.label.localeCompare(b.label, "sv"),
      );
      const text = (n.acceptedText ?? "").trim() || null;
      const requiresConfirm = n.requiresUserConfirmation === true;
      const hasBlockingIssue =
        // Required note with no accepted text → blocking
        (n.requirementLevel === "required" && !text) ||
        // AI-generated text not yet user-confirmed → blocking before final export
        (requiresConfirm && !n.confirmedByUser);

      return {
        id: n.id,
        noteNumber: n.noteNumber,
        noteType: n.noteType,
        title: n.title,
        text,
        rows,
        confirmedByUser: n.confirmedByUser,
        hasBlockingIssue,
      };
    });
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

function previousYearLabel(currentStart: string): string | null {
  const d = new Date(currentStart);
  if (Number.isNaN(d.getTime())) return null;
  return `Räkenskapsåret ${d.getUTCFullYear() - 1}`;
}

function buildPlaceholderManagementReport(
  company: CompanySnapshot,
  period: FiscalPeriod,
): ManagementReport {
  // Phase 6.6 ships with a structural förvaltningsberättelse skeleton so the
  // preview reflects required headings; user-edited content lands in this
  // structure in a follow-up phase.
  return {
    sections: [
      {
        heading: "Allmänt om verksamheten",
        paragraphs: [
          `${company.name} med organisationsnummer ${
            company.organizationNumber || "–"
          } bedriver sin verksamhet enligt bolagsordningen. ${period.label}.`,
        ],
      },
      {
        heading: "Väsentliga händelser under räkenskapsåret",
        paragraphs: ["—"],
      },
      {
        heading: "Förslag till resultatdisposition",
        paragraphs: ["—"],
      },
    ],
    multiYearOverview: null,
  };
}

// Re-export the demo helper so route handlers can short-circuit on the known
// demo UUID without reaching for /helpers/demo.
export { isKnownDemoProjectId };
