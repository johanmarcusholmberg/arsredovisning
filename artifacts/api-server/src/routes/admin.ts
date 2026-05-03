/**
 * Admin routes — site-admin-only operations.
 *
 * Auth chain:
 *   1. requireAuth + syncProfile (mounted globally) sets req.profile.
 *   2. requireSiteAdmin (below) verifies profiles.is_admin === true.
 *   3. Each handler does its own input validation and writes audit events.
 *
 * Bootstrap-admin protection:
 *   The hard-coded BOOTSTRAP_ADMIN_EMAILS in middlewares/auth.ts (mirrored
 *   here for self-containment) can NEVER be demoted, blocked, or deleted
 *   from the frontend. Any attempt returns 403 with a clear message.
 *
 * NOTE: at least one admin must be created out-of-band by setting
 * profiles.is_admin = true directly in the database, or by adding the
 * email to BOOTSTRAP_ADMIN_EMAILS so it is auto-promoted on first sign-in.
 */

import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq, sql, desc, count, inArray } from "drizzle-orm";
import {
  db,
  profilesTable,
  projectEntitlementsTable,
  annualReportProjectsTable,
  companiesTable,
  exportFilesTable,
  auditEventsTable,
} from "@workspace/db";
import { logAuditEvent } from "../lib/auditLog.js";
import { isProtectedAdminEmail } from "../lib/protectedAdmins.js";

const router: IRouter = Router();

// Local alias for readability inside this file.
const isProtectedEmail = isProtectedAdminEmail;

async function requireSiteAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const [me] = await db
    .select({ isAdmin: profilesTable.isAdmin, status: profilesTable.status })
    .from(profilesTable)
    .where(eq(profilesTable.id, profileId))
    .limit(1);
  if (!me?.isAdmin || me.status === "blocked") {
    // Match the rest of the API: hide existence to non-admins.
    res.status(404).json({ error: "not_found" });
    return;
  }
  next();
}

router.use("/admin", requireSiteAdmin);

// ─── Dashboard / stats ───────────────────────────────────────────────────────

/**
 * GET /admin/stats — high-level counts for the admin overview tab.
 */
router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [users] = await db
    .select({ total: count() })
    .from(profilesTable);
  const [admins] = await db
    .select({ total: count() })
    .from(profilesTable)
    .where(eq(profilesTable.isAdmin, true));
  const [blocked] = await db
    .select({ total: count() })
    .from(profilesTable)
    .where(eq(profilesTable.status, "blocked"));

  const [projectsAll] = await db
    .select({ total: count() })
    .from(annualReportProjectsTable);
  const [demoProjects] = await db
    .select({ total: count() })
    .from(annualReportProjectsTable)
    .where(eq(annualReportProjectsTable.isDemo, true));

  const [exportsAll] = await db
    .select({ total: count() })
    .from(exportFilesTable);
  const [exportsFailed] = await db
    .select({ total: count() })
    .from(exportFilesTable)
    .where(eq(exportFilesTable.exportStatus, "failed"));

  // Users who currently hold at least one active entitlement.
  const activeEntRows = await db
    .selectDistinct({ profileId: projectEntitlementsTable.profileId })
    .from(projectEntitlementsTable)
    .where(eq(projectEntitlementsTable.isActive, true));
  const paidUserCount = activeEntRows.filter((r) => r.profileId).length;

  const totalUsers = users?.total ?? 0;
  const realProjects = (projectsAll?.total ?? 0) - (demoProjects?.total ?? 0);
  const demoUserCount = Math.max(0, totalUsers - paidUserCount - (admins?.total ?? 0));

  res.json({
    totalUsers,
    adminUsers: admins?.total ?? 0,
    blockedUsers: blocked?.total ?? 0,
    paidUsers: paidUserCount,
    demoUsers: demoUserCount,
    totalProjects: projectsAll?.total ?? 0,
    realProjects,
    demoProjects: demoProjects?.total ?? 0,
    totalExports: exportsAll?.total ?? 0,
    failedExports: exportsFailed?.total ?? 0,
  });
});

// ─── Users ───────────────────────────────────────────────────────────────────

/**
 * GET /admin/users — list every profile with credit/admin/status info,
 * project counts, and last sign-in timestamp.
 */
router.get("/admin/users", async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: profilesTable.id,
      email: profilesTable.email,
      displayName: profilesTable.displayName,
      isAdmin: profilesTable.isAdmin,
      status: profilesTable.status,
      availableProjectCredits: profilesTable.availableProjectCredits,
      lastSignInAt: profilesTable.lastSignInAt,
      createdAt: profilesTable.createdAt,
    })
    .from(profilesTable)
    .orderBy(desc(profilesTable.createdAt));

  // Project ownership counts (cheap N+1 — admin only, small N).
  const projectCounts = await db
    .select({
      profileId: annualReportProjectsTable.createdByProfileId,
      total: count(),
    })
    .from(annualReportProjectsTable)
    .groupBy(annualReportProjectsTable.createdByProfileId);
  const countByProfile = new Map<string, number>();
  for (const row of projectCounts) {
    if (row.profileId) countByProfile.set(row.profileId, row.total);
  }

  // Active entitlement holders → "paid_user".
  const activeEnts = await db
    .selectDistinct({ profileId: projectEntitlementsTable.profileId })
    .from(projectEntitlementsTable)
    .where(eq(projectEntitlementsTable.isActive, true));
  const paidProfiles = new Set<string>();
  for (const r of activeEnts) {
    if (r.profileId) paidProfiles.add(r.profileId);
  }

  res.json({
    users: users.map((u) => ({
      ...u,
      projectCount: countByProfile.get(u.id) ?? 0,
      isProtected: isProtectedEmail(u.email),
      // Computed display role for the frontend.
      // admin > blocked > paid_user > demo_user
      accountRole:
        u.status === "blocked"
          ? "blocked"
          : u.isAdmin
            ? "admin"
            : paidProfiles.has(u.id) || u.availableProjectCredits > 0
              ? "paid_user"
              : "demo_user",
    })),
  });
});

/**
 * POST /admin/users/:profileId/grant-credits  { delta: integer }
 */
router.post(
  "/admin/users/:profileId/grant-credits",
  async (req, res): Promise<void> => {
    const targetId = req.params.profileId;
    const delta = Number((req.body as { delta?: unknown })?.delta);
    if (!Number.isInteger(delta) || delta === 0) {
      res
        .status(400)
        .json({ error: "invalid_input", message: "delta must be a non-zero integer" });
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
      payload: {
        targetProfileId: targetId,
        delta,
        newBalance: updated.availableProjectCredits,
      },
    });

    res.json({
      profileId: updated.id,
      availableProjectCredits: updated.availableProjectCredits,
    });
  },
);

/**
 * POST /admin/users/:profileId/set-admin  { isAdmin: boolean }
 * Bootstrap admin email cannot be demoted.
 */
router.post(
  "/admin/users/:profileId/set-admin",
  async (req, res): Promise<void> => {
    const targetId = req.params.profileId;
    const isAdmin = (req.body as { isAdmin?: unknown })?.isAdmin;
    if (typeof isAdmin !== "boolean") {
      res
        .status(400)
        .json({ error: "invalid_input", message: "isAdmin must be boolean" });
      return;
    }
    if (targetId === req.profile!.id && isAdmin === false) {
      res.status(400).json({ error: "invalid_input", message: "Cannot demote yourself" });
      return;
    }

    const [target] = await db
      .select({ id: profilesTable.id, email: profilesTable.email })
      .from(profilesTable)
      .where(eq(profilesTable.id, targetId))
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "not_found", message: "Profile not found" });
      return;
    }
    if (isProtectedEmail(target.email) && isAdmin === false) {
      res
        .status(403)
        .json({ error: "forbidden", message: "Protected admin cannot be demoted" });
      return;
    }

    const [updated] = await db
      .update(profilesTable)
      .set({ isAdmin, updatedAt: new Date() })
      .where(eq(profilesTable.id, targetId))
      .returning({ id: profilesTable.id, isAdmin: profilesTable.isAdmin });

    await logAuditEvent({
      eventType: "admin.role_changed",
      actorProfileId: req.profile!.id,
      payload: { targetProfileId: targetId, isAdmin },
    });

    res.json(updated);
  },
);

/**
 * POST /admin/users/:profileId/set-status  { status: "active" | "blocked" }
 * Blocking denies all authenticated API access for the target user.
 * Bootstrap admin email cannot be blocked.
 */
router.post(
  "/admin/users/:profileId/set-status",
  async (req, res): Promise<void> => {
    const targetId = req.params.profileId;
    const status = (req.body as { status?: unknown })?.status;
    if (status !== "active" && status !== "blocked") {
      res.status(400).json({
        error: "invalid_input",
        message: "status must be 'active' or 'blocked'",
      });
      return;
    }
    if (targetId === req.profile!.id && status === "blocked") {
      res
        .status(400)
        .json({ error: "invalid_input", message: "Cannot block yourself" });
      return;
    }

    const [target] = await db
      .select({
        id: profilesTable.id,
        email: profilesTable.email,
        status: profilesTable.status,
      })
      .from(profilesTable)
      .where(eq(profilesTable.id, targetId))
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "not_found", message: "Profile not found" });
      return;
    }
    if (isProtectedEmail(target.email) && status === "blocked") {
      res
        .status(403)
        .json({ error: "forbidden", message: "Protected admin cannot be blocked" });
      return;
    }

    const [updated] = await db
      .update(profilesTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(profilesTable.id, targetId))
      .returning({ id: profilesTable.id, status: profilesTable.status });

    await logAuditEvent({
      eventType: "admin.status_changed",
      actorProfileId: req.profile!.id,
      payload: {
        targetProfileId: targetId,
        before: target.status,
        after: status,
      },
    });

    res.json(updated);
  },
);

// ─── Projects ────────────────────────────────────────────────────────────────

/**
 * GET /admin/projects — overview of every project (real + demo) with
 * entitlement / payment status. Returns metadata only; actual accounting
 * data stays gated behind per-project access.
 */
router.get("/admin/projects", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: annualReportProjectsTable.id,
      companyName: companiesTable.name,
      companyOrgNumber: companiesTable.organizationNumber,
      fiscalYearStart: annualReportProjectsTable.fiscalYearStart,
      fiscalYearEnd: annualReportProjectsTable.fiscalYearEnd,
      status: annualReportProjectsTable.status,
      isDemo: annualReportProjectsTable.isDemo,
      createdAt: annualReportProjectsTable.createdAt,
      updatedAt: annualReportProjectsTable.updatedAt,
      ownerProfileId: annualReportProjectsTable.createdByProfileId,
      ownerEmail: profilesTable.email,
    })
    .from(annualReportProjectsTable)
    .innerJoin(
      companiesTable,
      eq(annualReportProjectsTable.companyId, companiesTable.id),
    )
    .leftJoin(
      profilesTable,
      eq(annualReportProjectsTable.createdByProfileId, profilesTable.id),
    )
    .orderBy(desc(annualReportProjectsTable.createdAt));

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

  // Latest export status per project.
  const latestExports = await db
    .select({
      projectId: exportFilesTable.projectId,
      exportStatus: exportFilesTable.exportStatus,
      createdAt: exportFilesTable.createdAt,
    })
    .from(exportFilesTable)
    .orderBy(desc(exportFilesTable.createdAt));
  const latestExportByProject = new Map<
    string,
    { exportStatus: string; createdAt: Date }
  >();
  for (const e of latestExports) {
    if (!latestExportByProject.has(e.projectId)) {
      latestExportByProject.set(e.projectId, {
        exportStatus: e.exportStatus,
        createdAt: e.createdAt,
      });
    }
  }

  res.json({
    projects: rows.map((p) => {
      const lastExport = latestExportByProject.get(p.id);
      return {
        id: p.id,
        companyName: p.companyName,
        companyOrgNumber: p.companyOrgNumber,
        fiscalYearStart: p.fiscalYearStart,
        fiscalYearEnd: p.fiscalYearEnd,
        status: p.status,
        isDemo: p.isDemo,
        ownerEmail: p.ownerEmail,
        hasActiveEntitlement: activeByProject.has(p.id),
        projectKind: p.isDemo ? "demo" : "real",
        latestExportStatus: lastExport?.exportStatus ?? null,
        latestExportAt: lastExport?.createdAt ?? null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    }),
  });
});

router.post("/admin/projects/:projectId/grant", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const [project] = await db
    .select({
      id: annualReportProjectsTable.id,
      createdByProfileId: annualReportProjectsTable.createdByProfileId,
    })
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

// ─── Payments ───────────────────────────────────────────────────────────────

/**
 * GET /admin/payments — every entitlement / payment record with linked
 * project + payer info. Surfaces Stripe IDs once Stripe webhooks are wired.
 */
router.get("/admin/payments", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: projectEntitlementsTable.id,
      projectId: projectEntitlementsTable.projectId,
      profileId: projectEntitlementsTable.profileId,
      entitlementType: projectEntitlementsTable.entitlementType,
      source: projectEntitlementsTable.source,
      isActive: projectEntitlementsTable.isActive,
      stripePaymentIntentId: projectEntitlementsTable.stripePaymentIntentId,
      stripeSubscriptionId: projectEntitlementsTable.stripeSubscriptionId,
      validFrom: projectEntitlementsTable.validFrom,
      validUntil: projectEntitlementsTable.validUntil,
      createdAt: projectEntitlementsTable.createdAt,
      payerEmail: profilesTable.email,
      companyName: companiesTable.name,
    })
    .from(projectEntitlementsTable)
    .leftJoin(
      profilesTable,
      eq(projectEntitlementsTable.profileId, profilesTable.id),
    )
    .leftJoin(
      annualReportProjectsTable,
      eq(projectEntitlementsTable.projectId, annualReportProjectsTable.id),
    )
    .leftJoin(
      companiesTable,
      eq(annualReportProjectsTable.companyId, companiesTable.id),
    )
    .orderBy(desc(projectEntitlementsTable.createdAt));

  res.json({ payments: rows });
});

// ─── Audit log ───────────────────────────────────────────────────────────────

/**
 * GET /admin/audit?limit=200 — recent audit events, joined with the actor
 * email for human-readable rendering. Capped at 500 rows per request.
 */
router.get("/admin/audit", async (req, res): Promise<void> => {
  const requested = Number(req.query["limit"] ?? 200);
  const limit = Math.min(
    500,
    Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 200),
  );

  const rows = await db
    .select({
      id: auditEventsTable.id,
      eventType: auditEventsTable.eventType,
      actorProfileId: auditEventsTable.actorProfileId,
      projectId: auditEventsTable.projectId,
      companyId: auditEventsTable.companyId,
      eventData: auditEventsTable.eventData,
      createdAt: auditEventsTable.createdAt,
      actorEmail: profilesTable.email,
    })
    .from(auditEventsTable)
    .leftJoin(
      profilesTable,
      eq(auditEventsTable.actorProfileId, profilesTable.id),
    )
    .orderBy(desc(auditEventsTable.createdAt))
    .limit(limit);

  res.json({ events: rows });
});

// Suppress unused-import warnings for helpers reserved for future use.
void sql;
void inArray;

export default router;
