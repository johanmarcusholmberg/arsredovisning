import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  reportsTable,
  companiesTable,
  reportNotesTable,
  reportNoteRowsTable,
  noteStatementReferencesTable,
  financialStatementLinesTable,
  validationDismissalsTable,
  annualReportReclassificationSuggestionsTable,
  annualReportReclassificationsTable,
} from "@workspace/db";
import { reconcileNotes } from "./noteReconciliation.js";
import {
  getPresentedNoteRowAmounts,
  getPresentedStatementLineAdjustments,
} from "./presentationAmounts.js";

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
    // Balance sheet must balance (assets = equity + liabilities) AFTER
    // applying active reclassifications. Phase 6.5 reclassifications can
    // touch report-node lines (`report_node_only`,
    // `note_and_report_node`) so a balance check against raw mapped
    // currentYearAmount would diverge from what the user sees in
    // preview/export. We therefore add the per-lineKey netDelta from
    // `getPresentedStatementLineAdjustments` to each summed line — the
    // same canonical helper used by the statements API and note
    // reconciliation, so all three views agree.
    const stmtAdjustments = await getPresentedStatementLineAdjustments(
      reportId,
    );
    const presentedCurrent = (lineKey: string, baseSum: number): number => {
      const adj = stmtAdjustments.get(lineKey);
      return adj ? baseSum + adj.netDelta : baseSum;
    };

    const bsLines = lines.filter((l) => l.statementType === "balance_sheet");
    const totalAssets = presentedCurrent(
      "total_assets",
      bsLines
        .filter((l) => l.lineKey === "total_assets")
        .reduce((s, l) => s + Number(l.currentYearAmount ?? 0), 0),
    );
    const totalEquityLiab = (() => {
      // Two synonymous canonical line keys may coexist in older reports;
      // sum both raw amounts and add whichever adjustments key actually
      // matched at write time (typically only one will be present).
      const raw = bsLines
        .filter(
          (l) =>
            l.lineKey === "total_equity_and_liabilities" ||
            l.lineKey === "total_liabilities_and_equity",
        )
        .reduce((s, l) => s + Number(l.currentYearAmount ?? 0), 0);
      const a =
        (stmtAdjustments.get("total_equity_and_liabilities")?.netDelta ?? 0) +
        (stmtAdjustments.get("total_liabilities_and_equity")?.netDelta ?? 0);
      return raw + a;
    })();

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

    // Warning: large YoY movements on income statement. Current-year
    // amounts are taken post-reclassification (presented) for the same
    // reason as above; previous-year amounts are unchanged because
    // reclassifications never touch the comparative period.
    for (const l of lines.filter((x) => x.statementType === "income_statement")) {
      const baseC = Number(l.currentYearAmount ?? 0);
      const c = presentedCurrent(l.lineKey, baseC);
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
    if (n.textIsAiGenerated && n.acceptedText && !n.confirmedByUser) {
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

  // Blocking: explicit confirmation required but missing
  for (const n of activeNotes) {
    if (n.requiresUserConfirmation && !n.confirmedByUser) {
      issues.push({
        ruleKey: `note:confirmation_missing:${n.id}`,
        level: "blocking",
        section: "notes",
        message: `Noten "${n.title}" kräver uttrycklig bekräftelse innan rapporten kan lämnas in.`,
        entityRef: n.id,
        isHighRisk: false,
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

  // Warning: gaps in note numbering (e.g. 1, 2, 4 with 3 missing)
  const usedNumbers = activeNotes
    .map((n) => n.noteNumber)
    .filter((x): x is number => typeof x === "number")
    .sort((a, b) => a - b);
  if (usedNumbers.length > 0) {
    const expectedMax = usedNumbers.length;
    const actualMax = usedNumbers[usedNumbers.length - 1];
    if (actualMax > expectedMax) {
      const missing: number[] = [];
      for (let i = 1; i <= actualMax; i++) {
        if (!usedNumbers.includes(i)) missing.push(i);
      }
      if (missing.length > 0) {
        issues.push({
          ruleKey: `notes:numbering_gap`,
          level: "warning",
          section: "notes",
          message: `Lucka i notnumreringen: nr ${missing.join(", ")} saknas. Kör om numreringen.`,
          entityRef: null,
          isHighRisk: false,
          quickLinkPath: `/reports/${report.id}/notes`,
        });
      }
    }
  }

  // Blocking: a statement line carries a "Not X" badge that doesn't resolve
  // to any active note. This is a structural reference-integrity violation —
  // we must flag it even when zero active notes exist, because that means
  // every badge on the report is broken.
  if (lines.length > 0) {
    const activeNumberSet = new Set(usedNumbers);
    for (const l of lines) {
      const badge = l.noteReferenceText;
      if (!badge) continue;
      const refs = badge.split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
      const broken = refs.filter((n) => !activeNumberSet.has(n));
      if (broken.length > 0) {
        issues.push({
          ruleKey: `noteref:unresolved:${l.id}`,
          level: "blocking",
          section: "notes",
          message: `Raden "${l.swedishLabel}" hänvisar till not ${broken.join(", ")} som inte längre finns. Kör om numreringen.`,
          entityRef: l.id,
          isHighRisk: true,
          quickLinkPath: `/reports/${report.id}/notes`,
        });
      }
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

  // Note total reconciliation — warn when a note's total disagrees with the
  // sum of its linked statement lines.
  if (activeNotes.length > 0) {
    const reconciliation = await reconcileNotes(reportId);
    for (const item of reconciliation.items) {
      if (item.status === "mismatch" && item.differenceCurrent !== null) {
        const diff = Number(item.differenceCurrent);
        const noteLabel = item.noteNumber !== null
          ? `Not ${item.noteNumber} (${item.title})`
          : item.title;
        issues.push({
          ruleKey: `note:reconciliation_mismatch:${item.noteId}`,
          level: "warning",
          section: "notes",
          message: `${noteLabel}: notens summa stämmer inte med rapportraderna (differens ${Math.abs(diff).toLocaleString("sv-SE")} kr).`,
          entityRef: item.noteId,
          isHighRisk: true,
          quickLinkPath: `/reports/${report.id}/notes`,
        });
      } else if (item.status === "missing_link" && item.noteTotalCurrent !== null) {
        const noteLabel = item.noteNumber !== null
          ? `Not ${item.noteNumber} (${item.title})`
          : item.title;
        issues.push({
          ruleKey: `note:reconciliation_missing_link:${item.noteId}`,
          level: "info",
          section: "notes",
          message: `${noteLabel} har en summa men ingen koppling till en rapportrad.`,
          entityRef: item.noteId,
          isHighRisk: false,
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

  // ── Reclassifications: pending suggestions and applied reclassifications ──
  const pendingSuggestions = await db
    .select({ id: annualReportReclassificationSuggestionsTable.id })
    .from(annualReportReclassificationSuggestionsTable)
    .where(
      and(
        eq(annualReportReclassificationSuggestionsTable.reportId, report.id),
        eq(annualReportReclassificationSuggestionsTable.status, "suggested"),
      ),
    );
  if (pendingSuggestions.length > 0) {
    issues.push({
      ruleKey: `reclassification:pending_suggestions`,
      level: "warning",
      section: "notes",
      message: `${pendingSuggestions.length} omklassificeringsförslag väntar på beslut. Granska dem innan rapporten lämnas in.`,
      entityRef: null,
      isHighRisk: false,
      quickLinkPath: `/reports/${report.id}/reclassifications`,
    });
  }

  const activeReclassifications = await db
    .select()
    .from(annualReportReclassificationsTable)
    .where(
      and(
        eq(annualReportReclassificationsTable.reportId, report.id),
        eq(annualReportReclassificationsTable.status, "active"),
      ),
    );
  if (activeReclassifications.length > 0) {
    issues.push({
      ruleKey: `reclassification:applied_count`,
      level: "info",
      section: "notes",
      message: `${activeReclassifications.length} omklassificering(ar) är tillämpade. Bekräfta att de är korrekt motiverade.`,
      entityRef: null,
      isHighRisk: false,
      quickLinkPath: `/reports/${report.id}/reclassifications`,
    });

    // ── Reclass-aware checks ────────────────────────────────────────────────

    // (a) Reference integrity: every active reclassification must point to
    // note rows that still exist and belong to active (not_applicable=false)
    // notes. Stale references mean the user deleted/inactivated a row after
    // approving a reclass — the presented amounts can no longer be trusted.
    const referencedRowIds = new Set<string>();
    for (const r of activeReclassifications) {
      if (r.sourceNoteRowId) referencedRowIds.add(r.sourceNoteRowId);
      if (r.targetNoteRowId) referencedRowIds.add(r.targetNoteRowId);
    }
    const liveRows = referencedRowIds.size === 0
      ? []
      : await db
          .select({
            rowId: reportNoteRowsTable.id,
            noteId: reportNotesTable.id,
            noteStatus: reportNotesTable.status,
            noteTitle: reportNotesTable.title,
          })
          .from(reportNoteRowsTable)
          .innerJoin(
            reportNotesTable,
            eq(reportNoteRowsTable.noteId, reportNotesTable.id),
          )
          .where(
            and(
              eq(reportNotesTable.reportId, report.id),
              inArray(reportNoteRowsTable.id, [...referencedRowIds]),
            ),
          );
    const liveById = new Map(liveRows.map((r) => [r.rowId, r]));

    for (const r of activeReclassifications) {
      const checks: Array<{
        rowId: string | null;
        side: "source" | "target";
        label: string | null;
      }> = [
        { rowId: r.sourceNoteRowId, side: "source", label: r.sourceLabel },
        { rowId: r.targetNoteRowId, side: "target", label: r.targetLabel },
      ];
      for (const c of checks) {
        if (!c.rowId) continue;
        const live = liveById.get(c.rowId);
        if (!live) {
          issues.push({
            ruleKey: `reclassification:row_missing:${r.id}:${c.side}`,
            level: "blocking",
            section: "notes",
            message: `Omklassificeringen mot ${
              c.label ?? "okänd rad"
            } pekar på en notrad som inte längre finns. Återkalla eller återställ raden.`,
            entityRef: r.id,
            isHighRisk: true,
            quickLinkPath: `/reports/${report.id}/reclassifications`,
          });
        } else if (live.noteStatus === "not_applicable") {
          issues.push({
            ruleKey: `reclassification:note_inactive:${r.id}:${c.side}`,
            level: "blocking",
            section: "notes",
            message: `Omklassificeringen mot ${
              c.label ?? live.noteTitle
            } pekar på en not som markerats ej tillämplig. Återkalla omklassificeringen.`,
            entityRef: r.id,
            isHighRisk: true,
            quickLinkPath: `/reports/${report.id}/reclassifications`,
          });
        }
      }
    }

    // (b) No-disappearance / no-double-counting: for every source row, the
    // sum of active outflows must not exceed |mapped| + inflows. This is
    // already enforced when creating a reclassification, but data can drift
    // (e.g. a row's mapped amount is changed downward after approval), so we
    // verify it again at validation time.
    const presented = await getPresentedNoteRowAmounts(report.id);
    const sourceRowIds = new Set<string>();
    for (const r of activeReclassifications) {
      if (r.sourceNoteRowId) sourceRowIds.add(r.sourceNoteRowId);
    }
    for (const rowId of sourceRowIds) {
      const p = presented.get(rowId);
      if (!p) continue;
      const mappedAbs = Math.abs(Number(p.mappedCurrentYearAmount ?? 0));
      const inflow = Number(p.inflowsCurrentYear);
      const outflow = Number(p.outflowsCurrentYear);
      if (outflow > mappedAbs + inflow + 1) {
        const live = liveById.get(rowId);
        issues.push({
          ruleKey: `reclassification:over_allocation:${rowId}`,
          level: "blocking",
          section: "notes",
          message: `Källraden ${
            live?.noteTitle ?? rowId
          } är överallokerad: utflöden (${outflow.toLocaleString(
            "sv-SE",
          )} kr) är större än mappat värde plus inflöden. Justera eller återkalla en omklassificering.`,
          entityRef: rowId,
          isHighRisk: true,
          quickLinkPath: `/reports/${report.id}/reclassifications`,
        });
      }
    }

    // (c) Net-zero conservation across notes AND report nodes. EVERY
    // active reclassification — irrespective of `effectType` — must
    // have both a source and a target inside the report. Without a
    // source, the entry inflates the target's presented amount with
    // no offsetting outflow anywhere else (value created from
    // nothing); without a target, value disappears. This is a
    // blocking issue, not a warning, because the unbalanced entry
    // already affects the presented numbers exposed via
    // `getPresentedStatementLineAdjustments` — letting the report
    // ship would publish broken figures. Earlier rounds only checked
    // `note_only`, which missed the more dangerous
    // `report_node_only`/`note_and_report_node` cases that surface
    // straight into the income statement / balance sheet.
    for (const r of activeReclassifications) {
      if (!r.sourceNoteRowId || !r.targetNoteRowId) {
        issues.push({
          ruleKey: `reclassification:unbalanced:${r.id}`,
          level: "blocking",
          section: "notes",
          message: `Omklassificeringen "${
            r.reason ?? r.targetLabel ?? r.id
          }" saknar ${
            r.sourceNoteRowId ? "målrad" : "källrad"
          } — den nettar inte mot någon annan post och ändrar presenterade summor utan motpost. Ange båda raderna eller återkalla omklassificeringen.`,
          entityRef: r.id,
          isHighRisk: true,
          quickLinkPath: `/reports/${report.id}/reclassifications`,
        });
      }
    }
  }

  // ── Cash flow statement (Kassaflödesanalys) ──────────────────────────────
  // Pulled in from the dedicated cash flow services so the validation engine
  // remains the single entry point for "is this report ready?".
  try {
    const { resolveProjectForReport } = await import(
      "../helpers/projectReportLink.js"
    );
    const link = await resolveProjectForReport(report.id);
    if (link?.projectId) {
      const { getOrCreateAssessment, deriveAssessmentResult, shouldIncludeCashFlow } =
        await import("./cashFlowAssessmentService.js");
      const { loadCashFlowStatement, validateCashFlowStatement } = await import(
        "./cashFlowStatementService.js"
      );

      const assessment = await getOrCreateAssessment(link.projectId);
      const verdict = deriveAssessmentResult(assessment);
      const requirement =
        assessment.assessmentStatus === "manually_overridden"
          ? assessment.cashFlowRequirement
          : verdict.cashFlowRequirement;

      // Requirement decision must be settled.
      if (requirement === "unknown") {
        issues.push({
          ruleKey: "cash_flow:requirement_unknown",
          level: "blocking",
          section: "validation",
          message:
            "Kassaflödesanalysens lagkrav är inte fastställt. Bekräfta uppgifterna i kassaflödessteget.",
          entityRef: assessment.id,
          isHighRisk: true,
          quickLinkPath: `/reports/${report.id}/cash-flow`,
        });
      }

      const includeInExport = shouldIncludeCashFlow({
        ...assessment,
        cashFlowRequirement: requirement,
      });

      if (includeInExport) {
        const stmt = await loadCashFlowStatement(link.projectId);
        if (!stmt) {
          issues.push({
            ruleKey: "cash_flow:statement_missing",
            level: "blocking",
            section: "validation",
            message:
              "Kassaflödesanalys krävs men har inte genererats. Generera och granska kassaflödet.",
            entityRef: assessment.id,
            isHighRisk: true,
            quickLinkPath: `/reports/${report.id}/cash-flow`,
          });
        } else {
          const cfResult = await validateCashFlowStatement(stmt.statement.id);
          for (const i of cfResult.issues) {
            issues.push({
              ruleKey: i.code,
              level: i.level,
              section: "validation",
              message: i.message,
              entityRef: stmt.statement.id,
              isHighRisk: i.level === "blocking",
              quickLinkPath: `/reports/${report.id}/cash-flow`,
            });
          }
        }
      } else if (
        requirement === "optional" &&
        !assessment.voluntaryEnabled
      ) {
        issues.push({
          ruleKey: "cash_flow:optional_disabled",
          level: "info",
          section: "validation",
          message:
            "Kassaflödesanalys är frivillig för detta företag och är inte aktiverad — den ingår inte i exporten.",
          entityRef: assessment.id,
          isHighRisk: false,
          quickLinkPath: `/reports/${report.id}/cash-flow`,
        });
      }
    }
  } catch (cfErr) {
    // Don't let cash flow checks crash the entire validation run.
    issues.push({
      ruleKey: "cash_flow:engine_error",
      level: "warning",
      section: "validation",
      message:
        "Kassaflödeskontrollen kunde inte köras automatiskt — kontrollera manuellt på kassaflödessidan.",
      entityRef: null,
      isHighRisk: false,
      quickLinkPath: `/reports/${report.id}/cash-flow`,
    });
    void cfErr;
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
