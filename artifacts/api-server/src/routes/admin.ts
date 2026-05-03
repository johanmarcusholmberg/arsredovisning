/**
 * Admin routes — site-admin-only operations.
 *
 * Auth chain:
 *   1. requireAuth + syncProfile (mounted globally) sets req.profile.
 *   2. requireSiteAdmin (below) verifies profiles.is_admin === true.
 *   3. Each handler does its own input validation and writes audit events.
 *
 * Until Stripe is wired, this is the only way for users to gain
 * project credits or be promoted to admin. Be careful:
 *
 *   - Never let a non-admin invoke any of these endpoints.
 *   - Never expose a "make me admin" path to authenticated users.
 *
 * Bootstrap: at least one admin must be created out-of-band by setting
 * profiles.is_admin = true directly in the database (or via the
 * ADMIN_BOOTSTRAP_EMAIL env var helper exposed below).
 */

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, sql, desc } from "drizzle-orm";
import {
  db,
  profilesTable,
  projectEntitlementsTable,
  annualReportProjectsTable,
  projectAccessTable,
  companiesTable,
} from "@workspace/db";
import { logAuditEvent } from "../lib/auditLog.js";

const router: IRouter = Router();

async function requireSiteAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const [me] = await db
    .select({ isAdmin: profilesTable.isAdmin })
    .from(profilesTable)
    .where(eq(profilesTable.id, profileId))
    .limit(1);
  if (!me?.isAdmin) {
    // Match the rest of the API: hide existence to non-admins.
    res.status(404).json({ error: "not_found" });
    return;
  }
  next();
}

router.use("/admin", requireSiteAdmin);

/**
 * GET /admin/users — list every profile with credit/admin info.
 * Only the columns we actually expose in the admin UI.
 */
router.get("/admin/users", async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: profilesTable.id,
      email: profilesTable.email,
      displayName: profilesTable.displayName,
      isAdmin: profilesTable.isAdmin,
      availableProjectCredits: profilesTable.availableProjectCredits,
      createdAt: profilesTable.createdAt,
    })
    .from(profilesTable)
    .orderBy(desc(profilesTable.createdAt));
  res.json({ users });
});

/**
 * POST /admin/users/:profileId/grant-credits  { delta: integer }
 * Adjusts available project credits. delta may be positive or negative
 * (e.g. revoke). Negative deltas can drive the count to 0 but never below.
 */
router.post("/admin/users/:profileId/grant-credits", async (req, res): Promise<void> => {
  const targetId = req.params.profileId;
  const delta = Number((req.body as { delta?: unknown })?.delta);
  if (!Number.isInteger(delta) || delta === 0) {
    res.status(400).json({ error: "invalid_input", message: "delta must be a non-zero integer" });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ credits: profilesTable.availableProjectCredits })
      .from(profilesTable)
      .where(eq(profilesTable.id, targetId))
      .for("update")
      .limit(1);
    if (!target) return null;
    const next = Math.max(0, target.credits + delta);
    const [row] = await tx
      .update(profilesTable)
      .set({ availableProjectCredits: next, updatedAt: new Date() })
      .where(eq(profilesTable.id, targetId))
      .returning({
        id: profilesTable.id,
        availableProjectCredits: profilesTable.availableProjectCredits,
      });
    return row;
  });

  if (!updated) {
    res.status(404).json({ error: "not_found", message: "Profile not found" });
    return;
  }

  await logAuditEvent({
    eventType: "admin.credits_adjusted",
    actorProfileId: req.profile!.id,
    payload: { targetProfileId: targetId, delta, newBalance: updated.availableProjectCredits },
  });

  res.json({ profileId: updated.id, availableProjectCredits: updated.availableProjectCredits });
});

/**
 * POST /admin/users/:profileId/set-admin  { isAdmin: boolean }
 * Promotes or demotes a user to/from site admin.
 */
router.post("/admin/users/:profileId/set-admin", async (req, res): Promise<void> => {
  const targetId = req.params.profileId;
  const isAdmin = (req.body as { isAdmin?: unknown })?.isAdmin;
  if (typeof isAdmin !== "boolean") {
    res.status(400).json({ error: "invalid_input", message: "isAdmin must be boolean" });
    return;
  }
  // Self-demotion guard: don't lock the system out by accident.
  if (targetId === req.profile!.id && isAdmin === false) {
    res.status(400).json({ error: "invalid_input", message: "Cannot demote yourself" });
    return;
  }

  const [updated] = await db
    .update(profilesTable)
    .set({ isAdmin, updatedAt: new Date() })
    .where(eq(profilesTable.id, targetId))
    .returning({ id: profilesTable.id, isAdmin: profilesTable.isAdmin });
  if (!updated) {
    res.status(404).json({ error: "not_found", message: "Profile not found" });
    return;
  }

  await logAuditEvent({
    eventType: "admin.role_changed",
    actorProfileId: req.profile!.id,
    payload: { targetProfileId: targetId, isAdmin },
  });

  res.json(updated);
});

/**
 * POST /admin/projects/:projectId/grant — manually issue an active entitlement
 * for an existing project (e.g. customer support / refund-recovery).
 */
router.post("/admin/projects/:projectId/grant", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const [project] = await db
    .select({ id: annualReportProjectsTable.id, createdByProfileId: annualReportProjectsTable.createdByProfileId })
    .from(annualReportProjectsTable)
    .where(eq(annualReportProjectsTable.id, projectId))
    .limit(1);
  if (!project) {
    res.status(404).json({ error: "not_found", message: "Project not found" });
    return;
  }
  await db.insert(projectEntitlementsTable).values({
    projectId,
    profileId: project.createdByProfileId ?? req.profile!.id,
    entitlementType: "manual_grant",
    source: "admin_grant",
    isActive: true,
  });
  await logAuditEvent({
    eventType: "admin.entitlement_granted",
    actorProfileId: req.profile!.id,
    projectId,
  });
  res.status(201).json({ ok: true });
});

/**
 * POST /admin/projects/:projectId/revoke — deactivate all active entitlements
 * on a project. The project remains in the DB but writes will start returning
 * 402 again.
 */
router.post("/admin/projects/:projectId/revoke", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  await db
    .update(projectEntitlementsTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(projectEntitlementsTable.projectId, projectId));
  await logAuditEvent({
    eventType: "admin.entitlement_revoked",
    actorProfileId: req.profile!.id,
    projectId,
  });
  res.json({ ok: true });
});

/**
 * GET /admin/projects — overview of every real project with entitlement status.
 */
router.get("/admin/projects", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: annualReportProjectsTable.id,
      companyName: companiesTable.name,
      fiscalYearStart: annualReportProjectsTable.fiscalYearStart,
      fiscalYearEnd: annualReportProjectsTable.fiscalYearEnd,
      status: annualReportProjectsTable.status,
      isDemo: annualReportProjectsTable.isDemo,
      createdAt: annualReportProjectsTable.createdAt,
      ownerEmail: profilesTable.email,
    })
    .from(annualReportProjectsTable)
    .innerJoin(companiesTable, eq(annualReportProjectsTable.companyId, companiesTable.id))
    .leftJoin(profilesTable, eq(annualReportProjectsTable.createdByProfileId, profilesTable.id))
    .orderBy(desc(annualReportProjectsTable.createdAt));

  // Cheap N+1 since this is admin only and small N.
  const ents = await db
    .select({
      projectId: projectEntitlementsTable.projectId,
      isActive: projectEntitlementsTable.isActive,
      entitlementType: projectEntitlementsTable.entitlementType,
    })
    .from(projectEntitlementsTable);
  const activeByProject = new Set(
    ents.filter((e) => e.isActive).map((e) => e.projectId),
  );

  res.json({
    projects: rows.map((p) => ({
      ...p,
      hasActiveEntitlement: activeByProject.has(p.id),
    })),
  });
});

// Suppress unused-import warning for the `sql` helper kept for future use.
void sql;

export default router;
