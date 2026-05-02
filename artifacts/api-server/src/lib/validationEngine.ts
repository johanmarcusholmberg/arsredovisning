import { and, eq } from "drizzle-orm";
import {
  db,
  reportsTable,
  companiesTable,
  reportNotesTable,
  noteStatementReferencesTable,
  financialStatementLinesTable,
  validationDismissalsTable,
} from "@workspace/db";

/**
 * ValidationIssue — one finding from the engine.
 *
 * `ruleKey` is deterministic so the same problem produces the same key on
 * every run; this is what dismissals are keyed on. Format:
 *   "<rule>:<entityRef?>"  e.g. "note:missing_text:5", "balance:imbalance"
 */
export type ValidationLevel = "blocking" | "warning" | "info";
export type ReportSectionId =
  | "import"
  | "mapping"
  | "financial_statements"
  | "notes"
  | "validation"
  | "export";

export interface ValidationIssue {
  ruleKey: string;
  level: ValidationLevel;
  section: ReportSectionId;
  message: string;
  entityRef: string | null;
  isHighRisk: boolean;
  quickLinkPath: string | null;
}

export interface ValidationEngineResult {
  issues: ValidationIssue[];
  blockingCount: number;
  warningCount: number;
  infoCount: number;
}

const LARGE_YOY_PCT = 0.5; // 50%
const LARGE_YOY_MIN_ABS = 1_000_000; // 1M SEK

function pct(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 1;
  return Math.abs((curr - prev) / prev);
}

/**
 * Run the full validation rules engine for a report. Pure read — does not
 * write to the DB. Returns a deterministic, ordered list of issues.
 */
export async function runValidation(
  reportId: string,
): Promise<ValidationEngineResult> {
  const issues: ValidationIssue[] = [];

  // Load report + company
  const [reportRow] = await db
    .select({ report: reportsTable, company: companiesTable })
    .from(reportsTable)
    .innerJoin(companiesTable, eq(reportsTable.companyId, companiesTable.id))
    .where(eq(reportsTable.id, reportId));

  if (!reportRow) {
    return { issues: [], blockingCount: 0, warningCount: 0, infoCount: 0 };
  }

  const { report, company } = reportRow;

  // ── Blocking: company core data ───────────────────────────────────────────
  if (!company.organizationNumber) {
    issues.push({
      ruleKey: "company:missing_org_number",
      level: "blocking",
      section: "import",
      message: "Organisationsnummer saknas på företaget.",
      entityRef: company.id,
      isHighRisk: false,
      quickLinkPath: `/companies/${company.id}`,
    });
  }
  if (!report.fiscalYearStart || !report.fiscalYearEnd) {
    issues.push({
      ruleKey: "report:missing_fiscal_year",
      level: "blocking",
      section: "import",
      message: "Räkenskapsårets start- eller slutdatum saknas.",
      entityRef: report.id,
      isHighRisk: false,
      quickLinkPath: `/reports/${report.id}`,
    });
  }

  // ── Financial statements ─────────────────────────────────────────────────
  const lines = await db
    .select()
    .from(financialStatementLinesTable)
    .where(eq(financialStatementLinesTable.reportId, reportId));

  if (lines.length === 0) {
    issues.push({
      ruleKey: "statements:not_generated",
      level: "blocking",
      section: "financial_statements",
      message:
        "Inga finansiella rapporter har genererats. Generera resultat- och balansräkning först.",
      entityRef: null,
      isHighRisk: false,
      quickLinkPath: `/reports/${report.id}/statements`,
    });
  } else {
    // Balance sheet must balance (assets = equity + liabilities)
    const bsLines = lines.filter((l) => l.statementType === "balance_sheet");
    const totalAssets = bsLines
      .filter((l) => l.lineKey === "total_assets")
      .reduce((s, l) => s + Number(l.currentYearAmount ?? 0), 0);
    const totalEquityLiab = bsLines
      .filter(
        (l) =>
          l.lineKey === "total_equity_and_liabilities" ||
          l.lineKey === "total_liabilities_and_equity",
      )
      .reduce((s, l) => s + Number(l.currentYearAmount ?? 0), 0);

    // Flag any non-trivial imbalance — including the case where one side is
    // zero and the other is not (e.g. missing equity rows). Only skip the
    // check if BOTH sides are exactly zero (no balance sheet to evaluate).
    if (totalAssets !== 0 || totalEquityLiab !== 0) {
      const diff = Math.abs(totalAssets - totalEquityLiab);
      if (diff > 1) {
        issues.push({
          ruleKey: "balance:imbalance",
          level: "blocking",
          section: "financial_statements",
          message: `Balansräkningen balanserar inte. Differens: ${diff.toLocaleString("sv-SE")} kr.`,
          entityRef: null,
          isHighRisk: true,
          quickLinkPath: `/reports/${report.id}/statements`,
        });
      }
    }

    // Warning: large YoY movements on income statement
    for (const l of lines.filter((x) => x.statementType === "income_statement")) {
      const c = Number(l.currentYearAmount ?? 0);
      const p = Number(l.previousYearAmount ?? 0);
      if (Math.abs(c - p) >= LARGE_YOY_MIN_ABS && pct(c, p) >= LARGE_YOY_PCT) {
        issues.push({
          ruleKey: `yoy:${l.statementType}:${l.lineKey}`,
          level: "warning",
          section: "financial_statements",
          message: `Stor förändring mot föregående år på "${l.swedishLabel}" (${c.toLocaleString("sv-SE")} kr vs ${p.toLocaleString("sv-SE")} kr). Kontrollera att förändringen är korrekt.`,
          entityRef: l.id,
          isHighRisk: true,
          quickLinkPath: `/reports/${report.id}/statements`,
        });
      }
    }
  }

  // ── Notes ────────────────────────────────────────────────────────────────
  const notes = await db
    .select()
    .from(reportNotesTable)
    .where(eq(reportNotesTable.reportId, reportId));

  const activeNotes = notes.filter((n) => n.status !== "not_applicable");

  // Blocking: required note has no accepted text
  for (const n of activeNotes) {
    if (n.requirementLevel === "required" && !n.acceptedText?.trim()) {
      issues.push({
        ruleKey: `note:missing_text:${n.id}`,
        level: "blocking",
        section: "notes",
        message: `Obligatorisk not "${n.title}" saknar bekräftad text.`,
        entityRef: n.id,
        isHighRisk: false,
        quickLinkPath: `/reports/${report.id}/notes`,
      });
    }
  }

  // Warning: AI-generated text not confirmed by user
  for (const n of activeNotes) {
    if (n.textIsAiGenerated && n.acceptedText) {
      issues.push({
        ruleKey: `note:ai_text_unconfirmed:${n.id}`,
        level: "warning",
        section: "notes",
        message: `Texten i "${n.title}" är AI-genererad. Granska och bekräfta innan inlämning.`,
        entityRef: n.id,
        isHighRisk: true,
        quickLinkPath: `/reports/${report.id}/notes`,
      });
    }
  }

  // Warning: duplicate note numbers (shouldn't happen with the numbering
  // service but worth catching)
  const numbersSeen = new Map<number, string[]>();
  for (const n of activeNotes) {
    if (n.noteNumber == null) continue;
    const arr = numbersSeen.get(n.noteNumber) ?? [];
    arr.push(n.title);
    numbersSeen.set(n.noteNumber, arr);
  }
  for (const [num, titles] of numbersSeen.entries()) {
    if (titles.length > 1) {
      issues.push({
        ruleKey: `notes:duplicate_number:${num}`,
        level: "warning",
        section: "notes",
        message: `Notnummer ${num} används av flera noter: ${titles.join(", ")}. Kör om numreringen.`,
        entityRef: null,
        isHighRisk: false,
        quickLinkPath: `/reports/${report.id}/notes`,
      });
    }
  }

  // Warning: broken note references (refs to inactive/missing notes)
  if (notes.length > 0) {
    const refs = await db
      .select()
      .from(noteStatementReferencesTable);
    const reportNoteIds = new Set(notes.map((n) => n.id));
    const activeIds = new Set(activeNotes.map((n) => n.id));
    for (const r of refs) {
      if (!reportNoteIds.has(r.noteId)) continue; // not for this report
      if (!activeIds.has(r.noteId)) {
        issues.push({
          ruleKey: `noteref:broken:${r.id}`,
          level: "warning",
          section: "notes",
          message: `Notreferens på rad "${r.lineKey}" pekar på en ej tillämplig not.`,
          entityRef: r.id,
          isHighRisk: true,
          quickLinkPath: `/reports/${report.id}/statements`,
        });
      }
    }
  }

  // Info: notes still in suggested/needs_review
  for (const n of activeNotes) {
    if (n.status === "suggested" || n.status === "needs_review") {
      issues.push({
        ruleKey: `note:pending_review:${n.id}`,
        level: "info",
        section: "notes",
        message: `Noten "${n.title}" väntar på granskning.`,
        entityRef: n.id,
        isHighRisk: false,
        quickLinkPath: `/reports/${report.id}/notes`,
      });
    }
  }

  // ── Apply dismissals ─────────────────────────────────────────────────────
  // Dismissed warnings/info are still returned, but the route layer can
  // surface them differently. We don't filter here — the caller decides.

  const blockingCount = issues.filter((i) => i.level === "blocking").length;
  const warningCount = issues.filter((i) => i.level === "warning").length;
  const infoCount = issues.filter((i) => i.level === "info").length;

  return { issues, blockingCount, warningCount, infoCount };
}

/**
 * Return the set of issueKeys that have been dismissed for this report.
 * Used by the routes layer to compute "active" vs "dismissed" counts.
 */
export async function loadDismissedKeys(reportId: string): Promise<Set<string>> {
  const rows = await db
    .select({ k: validationDismissalsTable.issueKey })
    .from(validationDismissalsTable)
    .where(eq(validationDismissalsTable.reportId, reportId));
  return new Set(rows.map((r) => r.k));
}
