import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  annualReportProjectsTable,
  companiesTable,
  profilesTable,
  projectAccessTable,
  projectEntitlementsTable,
} from "@workspace/db";
import { logAuditEvent } from "../lib/auditLog.js";
import {
  canViewProject,
  canCreateRealProject,
} from "../helpers/permissions.js";

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
 *
 * Requires: companyId (must be owned by caller), fiscalYearStart, fiscalYearEnd.
 *
 * Entitlement model:
 *   - Caller must satisfy canCreateRealProject (admin OR has credits).
 *   - On success we atomically:
 *       1. decrement profiles.availableProjectCredits by 1 (skipped for admins)
 *       2. insert the annual_report_projects row
 *       3. insert a manual_grant project_entitlements row (active)
 *       4. insert a project_access "owner" row for the creator
 *   - If any step fails the whole thing rolls back so we never leak credits
 *     into orphan projects or vice versa.
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

  if (!(await canCreateRealProject(profileId))) {
    res.status(402).json({
      error: "payment_required",
      message:
        "A paid project credit is required to create a real annual-report project.",
    });
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

  // Atomic: decrement credit (unless admin) → insert project →
  // insert entitlement → insert access.
  let project: typeof annualReportProjectsTable.$inferSelect;
  try {
    project = await db.transaction(async (tx) => {
      const [profile] = await tx
        .select({
          isAdmin: profilesTable.isAdmin,
          credits: profilesTable.availableProjectCredits,
        })
        .from(profilesTable)
        .where(eq(profilesTable.id, profileId))
        .for("update")
        .limit(1);

      if (!profile) throw new Error("profile_missing");
      if (!profile.isAdmin) {
        if (profile.credits < 1) throw new Error("insufficient_credits");
        await tx
          .update(profilesTable)
          .set({
            availableProjectCredits: sql`${profilesTable.availableProjectCredits} - 1`,
            updatedAt: new Date(),
          })
          .where(eq(profilesTable.id, profileId));
      }

      const [created] = await tx
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

      await tx.insert(projectEntitlementsTable).values({
        projectId: created.id,
        profileId,
        entitlementType: profile.isAdmin ? "manual_grant" : "manual_grant",
        source: profile.isAdmin ? "admin_grant" : "credit_redeemed",
        isActive: true,
      });

      await tx.insert(projectAccessTable).values({
        projectId: created.id,
        profileId,
        role: "owner",
        grantedByProfileId: profileId,
      });

      return created;
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "insufficient_credits" || msg === "profile_missing") {
      res.status(402).json({
        error: "payment_required",
        message: "No project credits available. Purchase a project to continue.",
      });
      return;
    }
    throw err;
  }

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
