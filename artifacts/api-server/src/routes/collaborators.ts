import { Router, type IRouter } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  db,
  reportsTable,
  reportCollaboratorsTable,
  projectSnapshotsTable,
  auditEventsTable,
  profilesTable,
  reportNotesTable,
  financialStatementLinesTable,
} from "@workspace/db";
import { logAuditEvent } from "../lib/auditLog.js";
import { requireReportAccess } from "../lib/reportAccess.js";

const router: IRouter = Router();

const ALL_ROLES = [
  "owner",
  "admin",
  "accountant",
  "reviewer",
  "auditor",
  "read_only",
] as const;
type ReportRole = (typeof ALL_ROLES)[number];

function isRole(s: string): s is ReportRole {
  return (ALL_ROLES as readonly string[]).includes(s);
}

async function getProfileNameAndEmail(
  profileId: string | null,
): Promise<{ name: string | null; email: string | null }> {
  if (!profileId) return { name: null, email: null };
  const [p] = await db
    .select({ name: profilesTable.displayName, email: profilesTable.email })
    .from(profilesTable)
    .where(eq(profilesTable.id, profileId));
  return { name: p?.name ?? null, email: p?.email ?? null };
}

// ─── GET /reports/:reportId/collaborators ────────────────────────────────────

router.get(
  "/reports/:reportId/collaborators",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "view_only");
    if (!access) return;

    // Owner is always the company creator
    const ownerProfileId = access.company.createdByProfileId;
    const ownerInfo = await getProfileNameAndEmail(ownerProfileId);

    const others = await db
      .select()
      .from(reportCollaboratorsTable)
      .where(eq(reportCollaboratorsTable.reportId, reportId));

    const ownerEntry = {
      profileId: ownerProfileId,
      email: ownerInfo.email ?? "",
      displayName: ownerInfo.name,
      role: "owner" as const,
      invitedByProfileId: null as string | null,
      createdAt: access.report.createdAt.toISOString(),
      isOwner: true,
    };

    const collabEntries = await Promise.all(
      others
        .filter((c) => c.profileId !== ownerProfileId)
        .map(async (c) => {
          const info = await getProfileNameAndEmail(c.profileId);
          return {
            profileId: c.profileId,
            email: info.email ?? c.inviteEmail ?? "",
            displayName: info.name,
            role: c.role,
            invitedByProfileId: c.invitedByProfileId,
            createdAt: c.createdAt.toISOString(),
            isOwner: false,
          };
        }),
    );

    res.json({ collaborators: [ownerEntry, ...collabEntries] });
  },
);

// ─── POST /reports/:reportId/collaborators ───────────────────────────────────

router.post(
  "/reports/:reportId/collaborators",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "manage_users");
    if (!access) return;

    const { email, role } = req.body as { email?: string; role?: string };
    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "invalid_input", message: "email is required" });
      return;
    }
    if (!role || !isRole(role)) {
      res.status(400).json({ error: "invalid_input", message: "Unknown role" });
      return;
    }
    if (role === "owner") {
      res.status(400).json({
        error: "invalid_input",
        message: "Ägarrollen kan inte tilldelas — det finns alltid endast en ägare.",
      });
      return;
    }

    // Find an existing profile for this email; if none, return error.
    // (Real invite flow with email send is out of scope for this phase.)
    const [target] = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.email, email.toLowerCase().trim()));

    if (!target) {
      res.status(404).json({
        error: "not_found",
        message: "Ingen användare med den här e-postadressen hittades. Be dem skapa ett konto först.",
      });
      return;
    }

    if (target.id === access.company.createdByProfileId) {
      res.status(400).json({
        error: "invalid_input",
        message: "Den här användaren är redan ägare av rapporten.",
      });
      return;
    }

    // Upsert by primary key (reportId, profileId)
    const [existing] = await db
      .select()
      .from(reportCollaboratorsTable)
      .where(
        and(
          eq(reportCollaboratorsTable.reportId, reportId),
          eq(reportCollaboratorsTable.profileId, target.id),
        ),
      );

    let saved;
    if (existing) {
      [saved] = await db
        .update(reportCollaboratorsTable)
        .set({ role: role as ReportRole, invitedByProfileId: profileId })
        .where(
          and(
            eq(reportCollaboratorsTable.reportId, reportId),
            eq(reportCollaboratorsTable.profileId, target.id),
          ),
        )
        .returning();
    } else {
      [saved] = await db
        .insert(reportCollaboratorsTable)
        .values({
          reportId,
          profileId: target.id,
          role: role as ReportRole,
          inviteEmail: email.toLowerCase().trim(),
          invitedByProfileId: profileId,
        })
        .returning();
    }

    await logAuditEvent({
      eventType: "user.invited",
      actorProfileId: profileId,
      companyId: access.company.id,
      projectId: reportId,
      payload: { reportId, invitedProfileId: target.id, email, role },
    });

    const info = await getProfileNameAndEmail(saved.profileId);
    res.status(201).json({
      profileId: saved.profileId,
      email: info.email ?? saved.inviteEmail ?? "",
      displayName: info.name,
      role: saved.role,
      invitedByProfileId: saved.invitedByProfileId,
      createdAt: saved.createdAt.toISOString(),
      isOwner: false,
    });
  },
);

// ─── DELETE /reports/:reportId/collaborators/:profileId ──────────────────────

router.delete(
  "/reports/:reportId/collaborators/:profileId",
  async (req, res): Promise<void> => {
    const callerProfileId = req.profile?.id;
    if (!callerProfileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, profileId: targetProfileId } = req.params;
    const access = await requireReportAccess(reportId, callerProfileId, res, "manage_users");
    if (!access) return;

    if (targetProfileId === access.company.createdByProfileId) {
      res.status(400).json({
        error: "invalid_input",
        message: "Ägaren kan inte tas bort.",
      });
      return;
    }

    await db
      .delete(reportCollaboratorsTable)
      .where(
        and(
          eq(reportCollaboratorsTable.reportId, reportId),
          eq(reportCollaboratorsTable.profileId, targetProfileId),
        ),
      );

    await logAuditEvent({
      eventType: "user.removed",
      actorProfileId: callerProfileId,
      companyId: access.company.id,
      projectId: reportId,
      payload: { reportId, removedProfileId: targetProfileId },
    });

    res.status(204).end();
  },
);

// ─── GET /reports/:reportId/snapshots ────────────────────────────────────────

router.get(
  "/reports/:reportId/snapshots",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "view_only");
    if (!access) return;
    void access;

    const rows = await db
      .select()
      .from(projectSnapshotsTable)
      .where(eq(projectSnapshotsTable.projectId, reportId))
      .orderBy(desc(projectSnapshotsTable.createdAt));

    const snapshots = await Promise.all(
      rows.map(async (s) => {
        const info = await getProfileNameAndEmail(s.actorProfileId);
        return {
          id: s.id,
          reportId,
          label: s.label,
          actorProfileId: s.actorProfileId,
          actorName: info.name,
          createdAt: s.createdAt.toISOString(),
        };
      }),
    );

    res.json({ snapshots });
  },
);

// ─── POST /reports/:reportId/snapshots ───────────────────────────────────────

router.post(
  "/reports/:reportId/snapshots",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "create_snapshot");
    if (!access) return;

    const { label } = req.body as { label?: string };
    if (!label || !label.trim()) {
      res.status(400).json({ error: "invalid_input", message: "label is required" });
      return;
    }

    // Snapshot the report state: report row + notes + statement lines.
    const [reportRow] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.id, reportId));
    const notes = await db
      .select()
      .from(reportNotesTable)
      .where(eq(reportNotesTable.reportId, reportId));
    const lines = await db
      .select()
      .from(financialStatementLinesTable)
      .where(eq(financialStatementLinesTable.reportId, reportId));

    const snapshotData = {
      report: reportRow,
      notes,
      statementLines: lines,
      capturedAt: new Date().toISOString(),
    };

    const [inserted] = await db
      .insert(projectSnapshotsTable)
      .values({
        projectId: reportId,
        companyId: access.company.id,
        actorProfileId: profileId,
        label: label.trim(),
        snapshotData,
      })
      .returning();

    await logAuditEvent({
      eventType: "snapshot.created",
      actorProfileId: profileId,
      companyId: access.company.id,
      projectId: reportId,
      payload: { reportId, snapshotId: inserted.id, label: label.trim() },
    });

    const info = await getProfileNameAndEmail(profileId);
    res.status(201).json({
      id: inserted.id,
      reportId,
      label: inserted.label,
      actorProfileId: inserted.actorProfileId,
      actorName: info.name,
      createdAt: inserted.createdAt.toISOString(),
    });
  },
);

// ─── GET /reports/:reportId/audit-events ─────────────────────────────────────

router.get(
  "/reports/:reportId/audit-events",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "view_only");
    if (!access) return;

    const limitRaw = req.query.limit;
    const limit = Math.min(
      Math.max(typeof limitRaw === "string" ? parseInt(limitRaw, 10) || 100 : 100, 1),
      500,
    );
    const category = typeof req.query.category === "string" ? req.query.category : null;

    // Match either:
    //  - audit row written with projectId = reportId (Phase 6+ pattern)
    //  - audit row that has reportId in eventData (older Phase 4/5 pattern)
    // Restrict to this company so we don't leak cross-tenant data.
    const conditions = [
      eq(auditEventsTable.companyId, access.company.id),
      or(
        eq(auditEventsTable.projectId, reportId),
        sql`${auditEventsTable.eventData}->>'reportId' = ${reportId}`,
      ),
    ];
    if (category) {
      conditions.push(sql`${auditEventsTable.eventType} LIKE ${category + "%"}`);
    }

    const rows = await db
      .select()
      .from(auditEventsTable)
      .where(and(...conditions))
      .orderBy(desc(auditEventsTable.createdAt))
      .limit(limit);

    const events = await Promise.all(
      rows.map(async (e) => {
        const info = await getProfileNameAndEmail(e.actorProfileId);
        return {
          id: e.id,
          eventType: e.eventType,
          actorProfileId: e.actorProfileId,
          actorName: info.name,
          eventData: (e.eventData as Record<string, unknown> | null) ?? null,
          createdAt: e.createdAt.toISOString(),
        };
      }),
    );

    res.json({ events });
  },
);

export default router;
