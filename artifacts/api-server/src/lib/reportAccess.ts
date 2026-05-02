import type { Response } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  reportsTable,
  companiesTable,
  reportCollaboratorsTable,
} from "@workspace/db";
import {
  can,
  resolveEffectiveRole,
  type Capability,
  type ReportRole,
} from "./permissions.js";

export interface ReportAccess {
  report: typeof reportsTable.$inferSelect;
  company: typeof companiesTable.$inferSelect;
  role: ReportRole;
  callerProfileId: string;
}

/**
 * Resolve the caller's effective role for `reportId` and (optionally) check a
 * required capability. Sends the right HTTP error and returns null when access
 * fails so the caller can simply `if (!access) return;`.
 */
export async function requireReportAccess(
  reportId: string,
  callerProfileId: string,
  res: Response,
  capability?: Capability,
): Promise<ReportAccess | null> {
  const [row] = await db
    .select({ report: reportsTable, company: companiesTable })
    .from(reportsTable)
    .innerJoin(companiesTable, eq(reportsTable.companyId, companiesTable.id))
    .where(eq(reportsTable.id, reportId));

  if (!row) {
    res.status(404).json({ error: "not_found", message: "Report not found" });
    return null;
  }

  const ownerProfileId = row.company.createdByProfileId;
  let collaboratorRole: ReportRole | null = null;
  if (ownerProfileId !== callerProfileId) {
    const [collab] = await db
      .select({ role: reportCollaboratorsTable.role })
      .from(reportCollaboratorsTable)
      .where(
        and(
          eq(reportCollaboratorsTable.reportId, reportId),
          eq(reportCollaboratorsTable.profileId, callerProfileId),
        ),
      );
    collaboratorRole = (collab?.role as ReportRole | undefined) ?? null;
  }

  const role = resolveEffectiveRole({
    ownerProfileId: ownerProfileId ?? "",
    collaboratorRole,
    callerProfileId,
  });

  if (!role) {
    // Don't leak existence: behave the same as not_found.
    res.status(404).json({ error: "not_found", message: "Report not found" });
    return null;
  }

  if (capability && !can(role, capability)) {
    res.status(403).json({
      error: "forbidden",
      message: "Du har inte behörighet att utföra den här åtgärden.",
    });
    return null;
  }

  return { report: row.report, company: row.company, role, callerProfileId };
}
