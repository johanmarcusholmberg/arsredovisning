import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  sectionReviewsTable,
  sectionCommentsTable,
  profilesTable,
} from "@workspace/db";
import { logAuditEvent } from "../lib/auditLog.js";
import { requireReportAccess } from "../lib/reportAccess.js";

const router: IRouter = Router();

const ALL_SECTIONS = [
  "import",
  "mapping",
  "financial_statements",
  "notes",
  "validation",
  "export",
] as const;
type SectionId = (typeof ALL_SECTIONS)[number];

const ALL_REVIEW_STATUSES = [
  "not_started",
  "in_progress",
  "ready_for_review",
  "changes_requested",
  "approved",
] as const;
type ReviewStatus = (typeof ALL_REVIEW_STATUSES)[number];

function isSection(s: string): s is SectionId {
  return (ALL_SECTIONS as readonly string[]).includes(s);
}

function isReviewStatus(s: string): s is ReviewStatus {
  return (ALL_REVIEW_STATUSES as readonly string[]).includes(s);
}

async function getProfileName(profileId: string | null): Promise<string | null> {
  if (!profileId) return null;
  const [p] = await db
    .select({ name: profilesTable.displayName, email: profilesTable.email })
    .from(profilesTable)
    .where(eq(profilesTable.id, profileId));
  return p?.name ?? p?.email ?? null;
}

// ─── GET /reports/:reportId/reviews ──────────────────────────────────────────

router.get(
  "/reports/:reportId/reviews",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "view_only");
    if (!access) return;

    const existing = await db
      .select()
      .from(sectionReviewsTable)
      .where(eq(sectionReviewsTable.reportId, reportId));

    const present = new Set(existing.map((r) => r.section));
    const missing = ALL_SECTIONS.filter((s) => !present.has(s));

    if (missing.length > 0) {
      await db.insert(sectionReviewsTable).values(
        missing.map((s) => ({
          reportId,
          section: s,
          status: "not_started" as const,
        })),
      );
    }

    const all = await db
      .select()
      .from(sectionReviewsTable)
      .where(eq(sectionReviewsTable.reportId, reportId))
      .orderBy(asc(sectionReviewsTable.section));

    const reviews = await Promise.all(
      all.map(async (r) => ({
        id: r.id,
        reportId: r.reportId,
        section: r.section,
        status: r.status,
        assignedToProfileId: r.assignedToProfileId,
        assignedToName: await getProfileName(r.assignedToProfileId),
        updatedByProfileId: r.updatedByProfileId,
        updatedAt: r.updatedAt.toISOString(),
      })),
    );

    res.json({ reviews });
  },
);

// ─── PATCH /reports/:reportId/reviews/:section ───────────────────────────────

router.patch(
  "/reports/:reportId/reviews/:section",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, section } = req.params;
    if (!isSection(section)) {
      res.status(400).json({ error: "invalid_input", message: "Unknown section" });
      return;
    }

    const access = await requireReportAccess(reportId, profileId, res, "mark_reviewed");
    if (!access) return;

    const body = req.body as {
      status?: string;
      assignedToProfileId?: string | null;
    };

    if (body.status !== undefined && !isReviewStatus(body.status)) {
      res.status(400).json({ error: "invalid_input", message: "Unknown status" });
      return;
    }

    // Upsert
    const [existing] = await db
      .select()
      .from(sectionReviewsTable)
      .where(
        and(
          eq(sectionReviewsTable.reportId, reportId),
          eq(sectionReviewsTable.section, section),
        ),
      );

    const previousStatus = existing?.status ?? "not_started";

    let saved;
    if (existing) {
      const update: Partial<typeof sectionReviewsTable.$inferInsert> & {
        updatedAt: Date;
        updatedByProfileId: string;
      } = {
        updatedAt: new Date(),
        updatedByProfileId: profileId,
      };
      if (body.status !== undefined) update.status = body.status as ReviewStatus;
      if (body.assignedToProfileId !== undefined) {
        update.assignedToProfileId = body.assignedToProfileId;
      }
      [saved] = await db
        .update(sectionReviewsTable)
        .set(update)
        .where(eq(sectionReviewsTable.id, existing.id))
        .returning();
    } else {
      [saved] = await db
        .insert(sectionReviewsTable)
        .values({
          reportId,
          section,
          status: (body.status as ReviewStatus) ?? "not_started",
          assignedToProfileId: body.assignedToProfileId ?? null,
          updatedByProfileId: profileId,
        })
        .returning();
    }

    if (body.status !== undefined && body.status !== previousStatus) {
      await logAuditEvent({
        eventType: "review.status_changed",
        actorProfileId: profileId,
        companyId: access.company.id,
        projectId: reportId,
        payload: { reportId, section, from: previousStatus, to: body.status },
      });
    }
    if (body.assignedToProfileId !== undefined) {
      await logAuditEvent({
        eventType: "review.assigned",
        actorProfileId: profileId,
        companyId: access.company.id,
        projectId: reportId,
        payload: { reportId, section, assignedToProfileId: body.assignedToProfileId },
      });
    }

    res.json({
      id: saved.id,
      reportId: saved.reportId,
      section: saved.section,
      status: saved.status,
      assignedToProfileId: saved.assignedToProfileId,
      assignedToName: await getProfileName(saved.assignedToProfileId),
      updatedByProfileId: saved.updatedByProfileId,
      updatedAt: saved.updatedAt.toISOString(),
    });
  },
);

// ─── GET /reports/:reportId/comments ─────────────────────────────────────────

router.get(
  "/reports/:reportId/comments",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "view_only");
    if (!access) return;

    const rawSection = typeof req.query.section === "string" ? req.query.section : null;
    if (rawSection && !isSection(rawSection)) {
      res.status(400).json({ error: "invalid_input", message: "Unknown section" });
      return;
    }
    const sectionFilter: SectionId | null = rawSection as SectionId | null;

    const where = sectionFilter
      ? and(
          eq(sectionCommentsTable.reportId, reportId),
          eq(sectionCommentsTable.section, sectionFilter),
        )
      : eq(sectionCommentsTable.reportId, reportId);

    const rows = await db
      .select()
      .from(sectionCommentsTable)
      .where(where)
      .orderBy(desc(sectionCommentsTable.createdAt));

    const comments = await Promise.all(
      rows.map(async (c) => ({
        id: c.id,
        reportId: c.reportId,
        section: c.section,
        entityId: c.entityId,
        body: c.body,
        createdByProfileId: c.createdByProfileId,
        createdByName: await getProfileName(c.createdByProfileId),
        createdAt: c.createdAt.toISOString(),
        resolved: c.resolved,
        resolvedByProfileId: c.resolvedByProfileId,
        resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null,
      })),
    );

    res.json({ comments });
  },
);

// ─── POST /reports/:reportId/comments ────────────────────────────────────────

router.post(
  "/reports/:reportId/comments",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "comment");
    if (!access) return;

    const { section, body, entityId } = req.body as {
      section?: string;
      body?: string;
      entityId?: string | null;
    };

    if (!section || !isSection(section)) {
      res.status(400).json({ error: "invalid_input", message: "section is required" });
      return;
    }
    if (!body || !body.trim()) {
      res.status(400).json({ error: "invalid_input", message: "body is required" });
      return;
    }

    const [inserted] = await db
      .insert(sectionCommentsTable)
      .values({
        reportId,
        section,
        body: body.trim(),
        entityId: entityId ?? null,
        createdByProfileId: profileId,
      })
      .returning();

    await logAuditEvent({
      eventType: "comment.created",
      actorProfileId: profileId,
      companyId: access.company.id,
      projectId: reportId,
      payload: { reportId, section, commentId: inserted.id },
    });

    res.status(201).json({
      id: inserted.id,
      reportId: inserted.reportId,
      section: inserted.section,
      entityId: inserted.entityId,
      body: inserted.body,
      createdByProfileId: inserted.createdByProfileId,
      createdByName: await getProfileName(inserted.createdByProfileId),
      createdAt: inserted.createdAt.toISOString(),
      resolved: inserted.resolved,
      resolvedByProfileId: inserted.resolvedByProfileId,
      resolvedAt: inserted.resolvedAt ? inserted.resolvedAt.toISOString() : null,
    });
  },
);

// ─── PATCH /reports/:reportId/comments/:commentId ────────────────────────────

router.patch(
  "/reports/:reportId/comments/:commentId",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, commentId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "comment");
    if (!access) return;

    const { resolved } = req.body as { resolved?: boolean };
    if (typeof resolved !== "boolean") {
      res.status(400).json({ error: "invalid_input", message: "resolved (boolean) is required" });
      return;
    }

    const [existing] = await db
      .select()
      .from(sectionCommentsTable)
      .where(
        and(
          eq(sectionCommentsTable.id, commentId),
          eq(sectionCommentsTable.reportId, reportId),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Comment not found" });
      return;
    }

    const [updated] = await db
      .update(sectionCommentsTable)
      .set({
        resolved,
        resolvedByProfileId: resolved ? profileId : null,
        resolvedAt: resolved ? new Date() : null,
      })
      .where(eq(sectionCommentsTable.id, commentId))
      .returning();

    await logAuditEvent({
      eventType: resolved ? "comment.resolved" : "comment.reopened",
      actorProfileId: profileId,
      companyId: access.company.id,
      projectId: reportId,
      payload: { reportId, commentId, section: existing.section },
    });

    res.json({
      id: updated.id,
      reportId: updated.reportId,
      section: updated.section,
      entityId: updated.entityId,
      body: updated.body,
      createdByProfileId: updated.createdByProfileId,
      createdByName: await getProfileName(updated.createdByProfileId),
      createdAt: updated.createdAt.toISOString(),
      resolved: updated.resolved,
      resolvedByProfileId: updated.resolvedByProfileId,
      resolvedAt: updated.resolvedAt ? updated.resolvedAt.toISOString() : null,
    });
  },
);

export default router;
