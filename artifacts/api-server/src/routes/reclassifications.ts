import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  reportsTable,
  companiesTable,
  reportNotesTable,
  reportNoteRowsTable,
  annualReportReclassificationSuggestionsTable,
  annualReportReclassificationsTable,
  annualReportReclassificationAuditLogTable,
} from "@workspace/db";
import { runReclassificationDetection } from "../lib/reclassificationEngine.js";
import { logReclassificationAudit } from "../lib/reclassificationAuditLog.js";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getReportWithCompany(reportId: string, profileId: string) {
  const [row] = await db
    .select({ report: reportsTable, company: companiesTable })
    .from(reportsTable)
    .innerJoin(companiesTable, eq(reportsTable.companyId, companiesTable.id))
    .where(
      and(
        eq(reportsTable.id, reportId),
        eq(companiesTable.createdByProfileId, profileId),
      ),
    );
  return row ?? null;
}

async function noteRowBelongsToReport(rowId: string, reportId: string) {
  const [row] = await db
    .select({ rowId: reportNoteRowsTable.id })
    .from(reportNoteRowsTable)
    .innerJoin(
      reportNotesTable,
      eq(reportNoteRowsTable.noteId, reportNotesTable.id),
    )
    .where(
      and(
        eq(reportNoteRowsTable.id, rowId),
        eq(reportNotesTable.reportId, reportId),
      ),
    );
  return Boolean(row);
}

// ─── Input validation ────────────────────────────────────────────────────────

const SUGGESTION_STATUSES = ["accepted", "rejected", "edited", "not_relevant"] as const;
type SuggestionUpdateStatus = (typeof SUGGESTION_STATUSES)[number];

const EFFECT_TYPES = [
  "note_only",
  "report_node_only",
  "note_and_report_node",
] as const;
type EffectType = (typeof EFFECT_TYPES)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface UpdateSuggestionStatusBody {
  status: SuggestionUpdateStatus;
  reviewerComment: string | null;
  editedAmount: string | null;
}

interface CreateReclassBody {
  sourceNoteRowId: string | null;
  targetNoteRowId: string;
  sourceLabel: string | null;
  targetLabel: string | null;
  amount: string;
  effectType: EffectType;
  reason: string | null;
  sourceSuggestionId: string | null;
}

function parseUpdateSuggestionStatusBody(
  raw: unknown,
): { ok: true; data: UpdateSuggestionStatusBody } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, message: "request body must be an object" };
  }
  const b = raw as Record<string, unknown>;
  if (
    typeof b.status !== "string" ||
    !SUGGESTION_STATUSES.includes(b.status as SuggestionUpdateStatus)
  ) {
    return {
      ok: false,
      message: `status must be one of: ${SUGGESTION_STATUSES.join(", ")}`,
    };
  }
  const reviewerComment =
    b.reviewerComment === undefined || b.reviewerComment === null
      ? null
      : typeof b.reviewerComment === "string"
        ? b.reviewerComment
        : null;
  const editedAmount =
    b.editedAmount === undefined || b.editedAmount === null
      ? null
      : typeof b.editedAmount === "string"
        ? b.editedAmount
        : null;
  return {
    ok: true,
    data: {
      status: b.status as SuggestionUpdateStatus,
      reviewerComment,
      editedAmount,
    },
  };
}

function parseCreateReclassBody(
  raw: unknown,
): { ok: true; data: CreateReclassBody } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, message: "request body must be an object" };
  }
  const b = raw as Record<string, unknown>;
  if (typeof b.targetNoteRowId !== "string" || !UUID_RE.test(b.targetNoteRowId)) {
    return { ok: false, message: "targetNoteRowId must be a UUID" };
  }
  if (
    b.sourceNoteRowId !== undefined &&
    b.sourceNoteRowId !== null &&
    (typeof b.sourceNoteRowId !== "string" || !UUID_RE.test(b.sourceNoteRowId))
  ) {
    return { ok: false, message: "sourceNoteRowId must be a UUID or null" };
  }
  if (typeof b.amount !== "string" || Number.isNaN(Number(b.amount)) || Number(b.amount) === 0) {
    return { ok: false, message: "amount must be a non-zero numeric string" };
  }
  const effectType =
    typeof b.effectType === "string" && EFFECT_TYPES.includes(b.effectType as EffectType)
      ? (b.effectType as EffectType)
      : "note_only";
  if (
    b.sourceSuggestionId !== undefined &&
    b.sourceSuggestionId !== null &&
    (typeof b.sourceSuggestionId !== "string" ||
      !UUID_RE.test(b.sourceSuggestionId))
  ) {
    return { ok: false, message: "sourceSuggestionId must be a UUID or null" };
  }
  return {
    ok: true,
    data: {
      sourceNoteRowId:
        typeof b.sourceNoteRowId === "string" ? b.sourceNoteRowId : null,
      targetNoteRowId: b.targetNoteRowId,
      sourceLabel: typeof b.sourceLabel === "string" ? b.sourceLabel : null,
      targetLabel: typeof b.targetLabel === "string" ? b.targetLabel : null,
      amount: b.amount,
      effectType,
      reason: typeof b.reason === "string" ? b.reason : null,
      sourceSuggestionId:
        typeof b.sourceSuggestionId === "string" ? b.sourceSuggestionId : null,
    },
  };
}

// ─── GET /reports/:reportId/reclassifications/suggestions ────────────────────

router.get(
  "/reports/:reportId/reclassifications/suggestions",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Report not found" });
      return;
    }

    const statusFilter = (req.query.status as string | undefined) ?? null;
    const where = statusFilter
      ? and(
          eq(annualReportReclassificationSuggestionsTable.reportId, reportId),
          eq(
            annualReportReclassificationSuggestionsTable.status,
            statusFilter as
              | "suggested"
              | "accepted"
              | "rejected"
              | "edited"
              | "not_relevant",
          ),
        )
      : eq(annualReportReclassificationSuggestionsTable.reportId, reportId);

    const suggestions = await db
      .select()
      .from(annualReportReclassificationSuggestionsTable)
      .where(where)
      .orderBy(
        desc(annualReportReclassificationSuggestionsTable.confidenceLevel),
        desc(annualReportReclassificationSuggestionsTable.detectedAt),
      );

    const summary = {
      suggested: 0,
      accepted: 0,
      rejected: 0,
      edited: 0,
      notRelevant: 0,
    };
    for (const s of suggestions) {
      if (s.status === "suggested") summary.suggested++;
      else if (s.status === "accepted") summary.accepted++;
      else if (s.status === "rejected") summary.rejected++;
      else if (s.status === "edited") summary.edited++;
      else if (s.status === "not_relevant") summary.notRelevant++;
    }

    res.json({ suggestions, summary });
  },
);

// ─── POST /reports/:reportId/reclassifications/suggestions/detect ────────────

router.post(
  "/reports/:reportId/reclassifications/suggestions/detect",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Report not found" });
      return;
    }

    const result = await runReclassificationDetection(reportId);

    await logReclassificationAudit({
      reportId,
      eventType: "suggestion_detected",
      actorProfileId: profileId,
      payload: {
        scanned: result.candidates.length,
        inserted: result.inserted,
        skippedAsDuplicates: result.skippedAsDuplicates,
      },
    });

    res.json({
      detected: result.candidates.length,
      inserted: result.inserted,
      skippedAsDuplicates: result.skippedAsDuplicates,
    });
  },
);

// ─── PATCH /reports/:reportId/reclassifications/suggestions/:suggestionId ────

router.patch(
  "/reports/:reportId/reclassifications/suggestions/:suggestionId",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const { reportId, suggestionId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Report not found" });
      return;
    }

    const parsed = parseUpdateSuggestionStatusBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: "invalid_input", message: parsed.message });
      return;
    }

    const [existing] = await db
      .select()
      .from(annualReportReclassificationSuggestionsTable)
      .where(
        and(
          eq(annualReportReclassificationSuggestionsTable.id, suggestionId),
          eq(annualReportReclassificationSuggestionsTable.reportId, reportId),
        ),
      );
    if (!existing) {
      res
        .status(404)
        .json({ error: "not_found", message: "Suggestion not found" });
      return;
    }

    const [updated] = await db
      .update(annualReportReclassificationSuggestionsTable)
      .set({
        status: parsed.data.status,
        reviewedByProfileId: profileId,
        reviewedAt: new Date(),
        reviewerComment: parsed.data.reviewerComment ?? null,
        suggestedAmount:
          parsed.data.status === "edited" && parsed.data.editedAmount
            ? parsed.data.editedAmount
            : existing.suggestedAmount,
        updatedAt: new Date(),
      })
      .where(eq(annualReportReclassificationSuggestionsTable.id, suggestionId))
      .returning();

    const eventType =
      parsed.data.status === "accepted"
        ? "suggestion_accepted"
        : parsed.data.status === "rejected"
          ? "suggestion_rejected"
          : parsed.data.status === "edited"
            ? "suggestion_edited"
            : "suggestion_marked_not_relevant";

    await logReclassificationAudit({
      reportId,
      eventType,
      actorProfileId: profileId,
      suggestionId,
      payload: {
        from: existing.status,
        to: parsed.data.status,
        comment: parsed.data.reviewerComment ?? null,
      },
    });

    res.json(updated);
  },
);

// ─── GET /reports/:reportId/reclassifications ────────────────────────────────

router.get(
  "/reports/:reportId/reclassifications",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Report not found" });
      return;
    }

    const rawStatus = req.query.status as string | undefined;
    const statusFilter: "active" | "undone" | null =
      rawStatus === "active" || rawStatus === "undone" ? rawStatus : "active";

    const where = statusFilter
      ? and(
          eq(annualReportReclassificationsTable.reportId, reportId),
          eq(annualReportReclassificationsTable.status, statusFilter),
        )
      : eq(annualReportReclassificationsTable.reportId, reportId);

    const reclasses = await db
      .select()
      .from(annualReportReclassificationsTable)
      .where(where)
      .orderBy(desc(annualReportReclassificationsTable.createdAt));

    res.json({ reclassifications: reclasses });
  },
);

// ─── POST /reports/:reportId/reclassifications ───────────────────────────────

router.post(
  "/reports/:reportId/reclassifications",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Report not found" });
      return;
    }

    const parsed = parseCreateReclassBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: "invalid_input", message: parsed.message });
      return;
    }

    // Validate the target row belongs to a note in this report.
    const targetOk = await noteRowBelongsToReport(
      parsed.data.targetNoteRowId,
      reportId,
    );
    if (!targetOk) {
      res.status(400).json({
        error: "invalid_input",
        message: "targetNoteRowId does not belong to this report",
      });
      return;
    }
    if (parsed.data.sourceNoteRowId) {
      const sourceOk = await noteRowBelongsToReport(
        parsed.data.sourceNoteRowId,
        reportId,
      );
      if (!sourceOk) {
        res.status(400).json({
          error: "invalid_input",
          message: "sourceNoteRowId does not belong to this report",
        });
        return;
      }
      if (parsed.data.sourceNoteRowId === parsed.data.targetNoteRowId) {
        res.status(400).json({
          error: "invalid_input",
          message: "source and target rows must differ",
        });
        return;
      }
    }

    const [inserted] = await db
      .insert(annualReportReclassificationsTable)
      .values({
        reportId,
        sourceSuggestionId: parsed.data.sourceSuggestionId ?? null,
        sourceNoteRowId: parsed.data.sourceNoteRowId ?? null,
        targetNoteRowId: parsed.data.targetNoteRowId,
        sourceLabel: parsed.data.sourceLabel ?? null,
        targetLabel: parsed.data.targetLabel ?? null,
        amount: parsed.data.amount,
        effectType: parsed.data.effectType,
        reason: parsed.data.reason ?? null,
        status: "active",
        createdByProfileId: profileId,
      })
      .returning();

    await logReclassificationAudit({
      reportId,
      eventType: "reclassification_created",
      actorProfileId: profileId,
      reclassificationId: inserted.id,
      suggestionId: parsed.data.sourceSuggestionId ?? null,
      payload: {
        sourceNoteRowId: inserted.sourceNoteRowId,
        targetNoteRowId: inserted.targetNoteRowId,
        amount: inserted.amount,
        effectType: inserted.effectType,
        reason: inserted.reason,
      },
    });

    res.status(201).json(inserted);
  },
);

// ─── POST /reports/:reportId/reclassifications/:reclassId/undo ───────────────

router.post(
  "/reports/:reportId/reclassifications/:reclassId/undo",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const { reportId, reclassId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Report not found" });
      return;
    }

    const [existing] = await db
      .select()
      .from(annualReportReclassificationsTable)
      .where(
        and(
          eq(annualReportReclassificationsTable.id, reclassId),
          eq(annualReportReclassificationsTable.reportId, reportId),
        ),
      );
    if (!existing) {
      res
        .status(404)
        .json({ error: "not_found", message: "Reclassification not found" });
      return;
    }
    if (existing.status === "undone") {
      res.status(409).json({
        error: "already_undone",
        message: "This reclassification has already been undone",
      });
      return;
    }

    const [updated] = await db
      .update(annualReportReclassificationsTable)
      .set({
        status: "undone",
        undoneAt: new Date(),
        undoneByProfileId: profileId,
        updatedAt: new Date(),
      })
      .where(eq(annualReportReclassificationsTable.id, reclassId))
      .returning();

    await logReclassificationAudit({
      reportId,
      eventType: "reclassification_undone",
      actorProfileId: profileId,
      reclassificationId: reclassId,
      payload: {
        previousAmount: existing.amount,
      },
    });

    res.json(updated);
  },
);

// ─── GET /reports/:reportId/reclassifications/audit-log ──────────────────────

router.get(
  "/reports/:reportId/reclassifications/audit-log",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Report not found" });
      return;
    }

    const entries = await db
      .select()
      .from(annualReportReclassificationAuditLogTable)
      .where(eq(annualReportReclassificationAuditLogTable.reportId, reportId))
      .orderBy(desc(annualReportReclassificationAuditLogTable.createdAt));

    res.json({ entries });
  },
);

export default router;
