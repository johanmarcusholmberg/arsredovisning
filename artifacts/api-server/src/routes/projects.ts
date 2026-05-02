import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, annualReportProjectsTable, companiesTable } from "@workspace/db";
import { logAuditEvent } from "../lib/auditLog.js";
import { canViewProject } from "../helpers/permissions.js";

const router: IRouter = Router();

/**
 * GET /projects — list all annual report projects for the authenticated user.
 * Scoped via companies.created_by_profile_id.
 */
router.get("/projects", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const projects = await db
    .select({
      id: annualReportProjectsTable.id,
      companyId: annualReportProjectsTable.companyId,
      companyName: companiesTable.name,
      fiscalYearStart: annualReportProjectsTable.fiscalYearStart,
      fiscalYearEnd: annualReportProjectsTable.fiscalYearEnd,
      accountingFramework: annualReportProjectsTable.accountingFramework,
      status: annualReportProjectsTable.status,
      noteNumberingScheme: annualReportProjectsTable.noteNumberingScheme,
      importedSieFileName: annualReportProjectsTable.importedSieFileName,
      createdAt: annualReportProjectsTable.createdAt,
      updatedAt: annualReportProjectsTable.updatedAt,
    })
    .from(annualReportProjectsTable)
    .innerJoin(companiesTable, eq(annualReportProjectsTable.companyId, companiesTable.id))
    .where(eq(companiesTable.createdByProfileId, profileId))
    .orderBy(annualReportProjectsTable.createdAt);

  res.json(projects);
});

/**
 * POST /projects — create a new annual report project.
 * Requires: companyId (must be owned by caller), fiscalYearStart, fiscalYearEnd.
 * Phase 2: all authenticated users can create projects. Stripe gating added in Phase 4.
 */
router.post("/projects", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const { companyId, fiscalYearStart, fiscalYearEnd, accountingFramework } = req.body as {
    companyId?: string;
    fiscalYearStart?: string;
    fiscalYearEnd?: string;
    accountingFramework?: string;
  };

  if (!companyId || !fiscalYearStart || !fiscalYearEnd) {
    res.status(400).json({ error: "invalid_input", message: "companyId, fiscalYearStart, fiscalYearEnd are required" });
    return;
  }

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(
      and(
        eq(companiesTable.id, companyId),
        eq(companiesTable.createdByProfileId, profileId),
      ),
    );

  if (!company) {
    res.status(404).json({ error: "not_found", message: "Company not found or access denied" });
    return;
  }

  const [project] = await db
    .insert(annualReportProjectsTable)
    .values({
      companyId,
      fiscalYearStart,
      fiscalYearEnd,
      accountingFramework: (accountingFramework as "K2" | "K3") ?? company.accountingFramework,
      status: "draft",
      noteNumberingScheme: "sequential",
      createdByProfileId: profileId,
    })
    .returning();

  await logAuditEvent({
    eventType: "project.created",
    actorProfileId: profileId,
    companyId,
    projectId: project.id,
    payload: { fiscalYearStart, fiscalYearEnd },
  });

  res.status(201).json({ ...project, companyName: company.name });
});

/**
 * GET /projects/:projectId — get a single project.
 */
router.get("/projects/:projectId", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const { projectId } = req.params;

  // Authoritative access check via project_access (covers owners + collaborators).
  // Returns 404 (not 403) on unauthorized to avoid leaking project existence.
  if (!(await canViewProject(profileId, projectId))) {
    res.status(404).json({ error: "not_found", message: "Project not found" });
    return;
  }

  const [row] = await db
    .select({
      id: annualReportProjectsTable.id,
      companyId: annualReportProjectsTable.companyId,
      companyName: companiesTable.name,
      fiscalYearStart: annualReportProjectsTable.fiscalYearStart,
      fiscalYearEnd: annualReportProjectsTable.fiscalYearEnd,
      accountingFramework: annualReportProjectsTable.accountingFramework,
      status: annualReportProjectsTable.status,
      noteNumberingScheme: annualReportProjectsTable.noteNumberingScheme,
      importedSieFileName: annualReportProjectsTable.importedSieFileName,
      createdAt: annualReportProjectsTable.createdAt,
      updatedAt: annualReportProjectsTable.updatedAt,
    })
    .from(annualReportProjectsTable)
    .innerJoin(companiesTable, eq(annualReportProjectsTable.companyId, companiesTable.id))
    .where(eq(annualReportProjectsTable.id, projectId));

  if (!row) {
    res.status(404).json({ error: "not_found", message: "Project not found" });
    return;
  }

  await logAuditEvent({
    eventType: "project.opened",
    actorProfileId: profileId,
    projectId: row.id,
    companyId: row.companyId,
  });

  res.json(row);
});

export default router;
