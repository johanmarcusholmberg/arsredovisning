import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  validationRunsTable,
  validationDismissalsTable,
} from "@workspace/db";
import { logAuditEvent } from "../lib/auditLog.js";
import {
  runValidation,
  loadDismissedKeys,
  type ValidationIssue,
} from "../lib/validationEngine.js";
import { requireReportAccess } from "../lib/reportAccess.js";

const router: IRouter = Router();

function readinessFromCounts(blocking: number): "ready" | "blocked" | "not_run" {
  return blocking === 0 ? "ready" : "blocked";
}

function shapeRun(run: {
  id: string | null;
  reportId: string;
  runByProfileId: string | null;
  runAt: Date | null;
  blockingCount: number;
  warningCount: number;
  infoCount: number;
  issues: ValidationIssue[];
}) {
  return {
    id: run.id,
    reportId: run.reportId,
    runByProfileId: run.runByProfileId,
    runAt: run.runAt ? run.runAt.toISOString() : null,
    blockingCount: run.blockingCount,
    warningCount: run.warningCount,
    infoCount: run.infoCount,
    issues: run.issues,
    readinessLevel: run.id ? readinessFromCounts(run.blockingCount) : "not_run",
  };
}

// ─── POST /reports/:reportId/validation/run ──────────────────────────────────

router.post(
  "/reports/:reportId/validation/run",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "run_validation");
    if (!access) return;

    const result = await runValidation(reportId);

    const [inserted] = await db
      .insert(validationRunsTable)
      .values({
        reportId,
        runByProfileId: profileId,
        blockingCount: result.blockingCount,
        warningCount: result.warningCount,
        infoCount: result.infoCount,
        issues: result.issues,
        summary: {
          blocking: result.blockingCount,
          warning: result.warningCount,
          info: result.infoCount,
        },
      })
      .returning();

    await logAuditEvent({
      eventType: "validation.run",
      actorProfileId: profileId,
      companyId: access.company.id,
      projectId: reportId,
      payload: {
        reportId,
        blockingCount: result.blockingCount,
        warningCount: result.warningCount,
        infoCount: result.infoCount,
      },
    });

    res.json(
      shapeRun({
        id: inserted.id,
        reportId,
        runByProfileId: profileId,
        runAt: inserted.runAt,
        blockingCount: result.blockingCount,
        warningCount: result.warningCount,
        infoCount: result.infoCount,
        issues: result.issues,
      }),
    );
  },
);

// ─── GET /reports/:reportId/validation/latest ────────────────────────────────

router.get(
  "/reports/:reportId/validation/latest",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "view_only");
    if (!access) return;

    const [latest] = await db
      .select()
      .from(validationRunsTable)
      .where(eq(validationRunsTable.reportId, reportId))
      .orderBy(desc(validationRunsTable.runAt))
      .limit(1);

    if (!latest) {
      res.json(
        shapeRun({
          id: null,
          reportId,
          runByProfileId: null,
          runAt: null,
          blockingCount: 0,
          warningCount: 0,
          infoCount: 0,
          issues: [],
        }),
      );
      return;
    }

    res.json(
      shapeRun({
        id: latest.id,
        reportId: latest.reportId,
        runByProfileId: latest.runByProfileId,
        runAt: latest.runAt,
        blockingCount: latest.blockingCount,
        warningCount: latest.warningCount,
        infoCount: latest.infoCount,
        issues: (latest.issues as ValidationIssue[]) ?? [],
      }),
    );
  },
);

// ─── POST /reports/:reportId/validation/dismiss ──────────────────────────────

router.post(
  "/reports/:reportId/validation/dismiss",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "dismiss_warning");
    if (!access) return;

    const { issueKey, comment } = req.body as {
      issueKey?: string;
      comment?: string | null;
    };

    if (!issueKey) {
      res.status(400).json({ error: "invalid_input", message: "issueKey is required" });
      return;
    }

    // Look up the issue in the latest run to enforce server-side rules.
    const [latest] = await db
      .select()
      .from(validationRunsTable)
      .where(eq(validationRunsTable.reportId, reportId))
      .orderBy(desc(validationRunsTable.runAt))
      .limit(1);

    const issues = (latest?.issues as ValidationIssue[] | undefined) ?? [];
    const match = issues.find((i) => i.ruleKey === issueKey);

    if (!match) {
      res.status(404).json({
        error: "not_found",
        message: "Issue not in latest validation run. Run validation first.",
      });
      return;
    }
    if (match.level === "blocking") {
      res.status(400).json({
        error: "invalid_input",
        message: "Blockerande problem kan inte avfärdas — de måste åtgärdas.",
      });
      return;
    }
    const requiresComment = !!match.isHighRisk;
    if (requiresComment && (!comment || !comment.trim())) {
      res.status(400).json({
        error: "invalid_input",
        message: "En kommentar krävs när du avfärdar en högrisk-varning.",
      });
      return;
    }

    // Upsert by (reportId, issueKey)
    const [existing] = await db
      .select()
      .from(validationDismissalsTable)
      .where(
        and(
          eq(validationDismissalsTable.reportId, reportId),
          eq(validationDismissalsTable.issueKey, issueKey),
        ),
      );

    let saved;
    if (existing) {
      [saved] = await db
        .update(validationDismissalsTable)
        .set({
          dismissedByProfileId: profileId,
          isHighRisk: match.isHighRisk,
          requiresComment,
          comment: comment ?? null,
          dismissedAt: new Date(),
        })
        .where(eq(validationDismissalsTable.id, existing.id))
        .returning();
    } else {
      [saved] = await db
        .insert(validationDismissalsTable)
        .values({
          reportId,
          issueKey,
          dismissedByProfileId: profileId,
          isHighRisk: match.isHighRisk,
          requiresComment,
          comment: comment ?? null,
        })
        .returning();
    }

    await logAuditEvent({
      eventType: "validation.dismiss",
      actorProfileId: profileId,
      companyId: access.company.id,
      projectId: reportId,
      payload: {
        reportId,
        issueKey,
        level: match.level,
        isHighRisk: match.isHighRisk,
        comment: comment ?? null,
      },
    });

    res.json({
      id: saved.id,
      reportId: saved.reportId,
      issueKey: saved.issueKey,
      dismissedByProfileId: saved.dismissedByProfileId,
      dismissedByName: null,
      isHighRisk: saved.isHighRisk,
      requiresComment: saved.requiresComment,
      comment: saved.comment,
      dismissedAt: saved.dismissedAt.toISOString(),
    });
  },
);

// ─── GET /reports/:reportId/validation/dismissals ────────────────────────────

router.get(
  "/reports/:reportId/validation/dismissals",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const access = await requireReportAccess(reportId, profileId, res, "view_only");
    if (!access) return;

    void loadDismissedKeys; // keep helper imported for callers

    const rows = await db
      .select()
      .from(validationDismissalsTable)
      .where(eq(validationDismissalsTable.reportId, reportId))
      .orderBy(desc(validationDismissalsTable.dismissedAt));

    res.json({
      dismissals: rows.map((r) => ({
        id: r.id,
        reportId: r.reportId,
        issueKey: r.issueKey,
        dismissedByProfileId: r.dismissedByProfileId,
        dismissedByName: null,
        isHighRisk: r.isHighRisk,
        requiresComment: r.requiresComment,
        comment: r.comment,
        dismissedAt: r.dismissedAt.toISOString(),
      })),
    });
  },
);

export default router;
