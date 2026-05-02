/**
 * Helper to bridge the two ID worlds in this codebase:
 *   - Most authoring data (financial_statement_lines, report_notes, …) is
 *     keyed by `reportId` (reports table).
 *   - All entitlement, demo, file, audit, and export-history data is keyed by
 *     `projectId` (annual_report_projects table).
 *
 * Both rows are ultimately tied to a (companyId, fiscalYear) pair, so we
 * resolve one to the other by matching on that pair.
 *
 * If no matching annual_report_projects row exists for a given report, we
 * return null. Callers may then treat the report as "real, no entitlement
 * gate, not demo" — useful while the unified project model is rolled out.
 */

import { eq, and, desc } from "drizzle-orm";
import {
  db,
  reportsTable,
  annualReportProjectsTable,
} from "@workspace/db";

export interface ResolvedProjectForReport {
  projectId: string | null;
  companyId: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  framework: string;
  reportStatus: string;
}

/**
 * Resolve the (best-matching) annual_report_projects row for a given report.
 * Returns null fields when no project row exists.
 */
export async function resolveProjectForReport(
  reportId: string,
): Promise<ResolvedProjectForReport | null> {
  const [report] = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.id, reportId))
    .limit(1);

  if (!report) return null;

  // Deterministic resolution: when multiple project rows exist for the same
  // (company, fiscal year) tuple — which is possible until we add a unique
  // index — pick the most recently created one. This guarantees the same
  // project is always chosen for entitlement, demo, audit, and export-history
  // operations, instead of relying on undefined row order.
  const [project] = await db
    .select({ id: annualReportProjectsTable.id })
    .from(annualReportProjectsTable)
    .where(
      and(
        eq(annualReportProjectsTable.companyId, report.companyId),
        eq(annualReportProjectsTable.fiscalYearStart, report.fiscalYearStart),
        eq(annualReportProjectsTable.fiscalYearEnd, report.fiscalYearEnd),
      ),
    )
    .orderBy(desc(annualReportProjectsTable.createdAt))
    .limit(1);

  return {
    projectId: project?.id ?? null,
    companyId: report.companyId,
    fiscalYearStart: report.fiscalYearStart,
    fiscalYearEnd: report.fiscalYearEnd,
    framework: report.accountingFramework,
    reportStatus: report.status,
  };
}

/**
 * Resolve the (best-matching) report row for a given project.
 * Returns null when no report exists yet.
 */
export async function resolveReportForProject(
  projectId: string,
): Promise<{ reportId: string; companyId: string } | null> {
  const [project] = await db
    .select()
    .from(annualReportProjectsTable)
    .where(eq(annualReportProjectsTable.id, projectId))
    .limit(1);

  if (!project) return null;

  const [report] = await db
    .select({ id: reportsTable.id })
    .from(reportsTable)
    .where(
      and(
        eq(reportsTable.companyId, project.companyId),
        eq(reportsTable.fiscalYearStart, project.fiscalYearStart),
        eq(reportsTable.fiscalYearEnd, project.fiscalYearEnd),
      ),
    )
    .orderBy(desc(reportsTable.createdAt))
    .limit(1);

  if (!report) return null;
  return { reportId: report.id, companyId: project.companyId };
}
