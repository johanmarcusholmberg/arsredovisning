import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
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
import {
  CreateReclassificationBody,
  UpdateReclassificationSuggestionStatusBody,
} from "@workspace/api-zod";
import { runReclassificationDetection } from "../lib/reclassificationEngine.js";
import { logReclassificationAudit } from "../lib/reclassificationAuditLog.js";
import {
  computeRowAggregates,
  type RowAggregates,
} from "../lib/presentationAmounts.js";

/**
 * SQL ordering for confidence_level — the column is a pgEnum
 * ('high'|'medium'|'low') and a default text sort surfaces them
 * alphabetically (high|low|medium), which is wrong. This expression
 * orders high → medium → low and is used wherever suggestions are
 * listed.
 */
const confidenceRankSql = sql`CASE
  WHEN ${annualReportReclassificationSuggestionsTable.confidenceLevel} = 'high' THEN 1
  WHEN ${annualReportReclassificationSuggestionsTable.confidenceLevel} = 'medium' THEN 2
  ELSE 3
END`;

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

interface NoteRowContext {
  rowId: string;
  noteId: string;
  noteStatus: string;
  mappedAmount: number | null;
}

async function loadNoteRowContext(
  rowId: string,
  reportId: string,
): Promise<NoteRowContext | null> {
  const [row] = await db
    .select({
      rowId: reportNoteRowsTable.id,
      noteId: reportNotesTable.id,
      noteStatus: reportNotesTable.status,
      mappedAmount: reportNoteRowsTable.currentYearAmount,
    })
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
  if (!row) return null;
  const m = row.mappedAmount === null ? null : Number(row.mappedAmount);
  return {
    rowId: row.rowId,
    noteId: row.noteId,
    noteStatus: row.noteStatus,
    mappedAmount: m === null || !Number.isFinite(m) ? null : m,
  };
}

const TOLERANCE_SEK = 1;

/**
 * Validate that applying a new reclassification of `amount` from `sourceCtx`
 * to `targetCtx` does not violate the safeguards:
 *   - both source and target rows must belong to active (not "not_applicable")
 *     notes
 *   - the source row's total active outflows after this entry cannot exceed
 *     |mappedAmount| + existing inflows (no value disappearance / no
 *     double-counting). When source is null (an external reclassification),
 *     no source-side check is performed.
 *
 * Pass `excludeReclassId` to ignore an existing reclassification when
 * recomputing — used to validate replacements/edits in the future.
 */
async function validateReclassification(opts: {
  reportId: string;
  amount: number;
  effectType: "note_only" | "report_node_only" | "note_and_report_node";
  sourceCtx: NoteRowContext | null;
  targetCtx: NoteRowContext;
  aggregates?: Map<string, RowAggregates>;
  excludeReclassId?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!Number.isFinite(opts.amount) || opts.amount <= 0) {
    return {
      ok: false,
      message:
        "Beloppet måste vara ett positivt tal. Riktningen anges via källrad och målrad — använd inte minustecken.",
    };
  }
  if (opts.targetCtx.noteStatus === "not_applicable") {
    return {
      ok: false,
      message: "Målnoten är markerad som ej tillämplig.",
    };
  }
  // Conservation invariant — enforced at WRITE time, not just surfaced as a
  // warning. EVERY reclassification must move value from a source row to a
  // target row, regardless of effect type. Without a source, the target
  // gets a free inflow and the presented amount on the report row (or the
  // note row, or both) increases without an offsetting decrease somewhere
  // else — i.e. value materializes out of nowhere. Earlier rounds carved
  // out `report_node_only` reclasses without a source on the assumption
  // that they "don't change note totals", but they still inflate the
  // statement-line presented amount, which violates conservation just as
  // badly as a sourceless `note_only` entry. The carve-out is gone.
  if (!opts.sourceCtx) {
    return {
      ok: false,
      message:
        "En omklassificering måste ha både en källrad och en målrad så att summan bevaras — annars skapas värde ur tomma intet på rapporten.",
    };
  }
  if (opts.sourceCtx) {
    if (opts.sourceCtx.noteStatus === "not_applicable") {
      return {
        ok: false,
        message: "Källnoten är markerad som ej tillämplig.",
      };
    }
    if (opts.sourceCtx.rowId === opts.targetCtx.rowId) {
      return { ok: false, message: "source and target rows must differ" };
    }

    const aggs =
      opts.aggregates ??
      (await computeRowAggregates(opts.reportId, {
        excludeReclassId: opts.excludeReclassId,
      }));
    const srcAgg = aggs.get(opts.sourceCtx.rowId) ?? {
      inflows: 0,
      outflows: 0,
    };
    // Capacity = |mapped| + existing inflows. Outflow can never push the
    // presented amount below zero (in absolute terms). This catches the
    // "value disappearance" and "double-counting" cases.
    const mappedAbs = Math.abs(opts.sourceCtx.mappedAmount ?? 0);
    const capacity = mappedAbs + srcAgg.inflows;
    const newOutflows = srcAgg.outflows + Math.abs(opts.amount);
    if (newOutflows > capacity + TOLERANCE_SEK) {
      return {
        ok: false,
        message: `Överallokering: källraden har ${mappedAbs.toLocaleString(
          "sv-SE",
        )} kr i mappat värde och ${srcAgg.inflows.toLocaleString(
          "sv-SE",
        )} kr i tidigare inflöden, men summan av utflöden skulle bli ${newOutflows.toLocaleString(
          "sv-SE",
        )} kr.`,
      };
    }
  }
  return { ok: true };
}

// ─── Input validation ────────────────────────────────────────────────────────
//
// Body parsing is delegated to the Zod schemas generated by Orval from the
// OpenAPI contract (`@workspace/api-zod`). This keeps server validation
// in lock-step with the published contract and the React Query client. The
// route layer adds the small handful of business invariants the contract
// cannot express (positive amount, reject "suggested" as an update target,
// etc.).

type SuggestionUpdateStatus = "accepted" | "rejected" | "edited" | "not_relevant";

type EffectType = "note_only" | "report_node_only" | "note_and_report_node";

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

function zodIssuesToMessage(issues: { path: (string | number)[]; message: string }[]): string {
  return issues
    .map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`)
    .join("; ");
}

function parseUpdateSuggestionStatusBody(
  raw: unknown,
): { ok: true; data: UpdateSuggestionStatusBody } | { ok: false; message: string } {
  const result = UpdateReclassificationSuggestionStatusBody.safeParse(raw);
  if (!result.success) {
    return { ok: false, message: zodIssuesToMessage(result.error.issues) };
  }
  const data = result.data;
  let editedAmount: string | null = null;
  if (data.editedAmount !== undefined && data.editedAmount !== null) {
    const n = Number(data.editedAmount);
    if (!Number.isFinite(n) || n <= 0) {
      return {
        ok: false,
        message:
          "editedAmount måste vara ett positivt tal — riktningen sätts via käll-/målrad.",
      };
    }
    editedAmount = data.editedAmount;
  }
  return {
    ok: true,
    data: {
      status: data.status,
      reviewerComment: data.reviewerComment ?? null,
      editedAmount,
    },
  };
}

function parseCreateReclassBody(
  raw: unknown,
): { ok: true; data: CreateReclassBody } | { ok: false; message: string } {
  const result = CreateReclassificationBody.safeParse(raw);
  if (!result.success) {
    return { ok: false, message: zodIssuesToMessage(result.error.issues) };
  }
  const data = result.data;
  const n = Number(data.amount);
  if (!Number.isFinite(n) || n <= 0) {
    return {
      ok: false,
      message:
        "amount måste vara ett positivt tal — riktningen anges via källrad och målrad, aldrig med minustecken.",
    };
  }
  return {
    ok: true,
    data: {
      sourceNoteRowId: data.sourceNoteRowId ?? null,
      targetNoteRowId: data.targetNoteRowId,
      sourceLabel: data.sourceLabel ?? null,
      targetLabel: data.targetLabel ?? null,
      amount: data.amount,
      effectType: data.effectType,
      reason: data.reason ?? null,
      sourceSuggestionId: data.sourceSuggestionId ?? null,
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
        asc(confidenceRankSql),
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
//
// When status === "accepted" this is an atomic operation: the suggestion
// transitions to "accepted" AND a corresponding reclassification row is
// inserted in the SAME database transaction. Other status transitions
// (rejected, edited, not_relevant) only update the suggestion.

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

    // Pre-validate before opening a transaction so we can return a clean 400
    // for accept-time safeguard violations without rolling anything back.
    let acceptedAmountStr: string | null = null;
    let acceptedAmountNum = 0;
    let sourceCtx: NoteRowContext | null = null;
    let targetCtx: NoteRowContext | null = null;

    if (parsed.data.status === "accepted") {
      // Idempotency: only allow accept from a non-final state. This blocks
      // double-accept (which would otherwise insert a second active reclass
      // for the same suggestion) and also catches accepting after reject.
      if (
        existing.status !== "suggested" &&
        existing.status !== "edited"
      ) {
        res.status(409).json({
          error: "invalid_state_transition",
          message: `Förslaget är redan i status "${existing.status}" och kan inte accepteras igen. Återställ det först om det behövs.`,
        });
        return;
      }
      acceptedAmountStr = existing.suggestedAmount;
      acceptedAmountNum = Number(acceptedAmountStr);
      if (
        !Number.isFinite(acceptedAmountNum) ||
        acceptedAmountNum <= 0
      ) {
        res.status(400).json({
          error: "invalid_input",
          message:
            "Förslagets belopp är saknat, noll eller negativt — redigera förslaget först.",
        });
        return;
      }
      if (!existing.targetNoteRowId) {
        res.status(400).json({
          error: "invalid_input",
          message:
            "Suggestion has no target row — cannot accept. Edit the suggestion first.",
        });
        return;
      }
      targetCtx = await loadNoteRowContext(existing.targetNoteRowId, reportId);
      if (!targetCtx) {
        res.status(409).json({
          error: "stale_reference",
          message:
            "Förslagets målrad har tagits bort eller flyttats — kan inte tillämpas.",
        });
        return;
      }
      if (existing.sourceNoteRowId) {
        sourceCtx = await loadNoteRowContext(existing.sourceNoteRowId, reportId);
        if (!sourceCtx) {
          res.status(409).json({
            error: "stale_reference",
            message:
              "Förslagets källrad har tagits bort eller flyttats — kan inte tillämpas.",
          });
          return;
        }
      }
      const validation = await validateReclassification({
        reportId,
        amount: acceptedAmountNum,
        effectType:
          (existing.effectType as
            | "note_only"
            | "report_node_only"
            | "note_and_report_node"
            | undefined) ?? "note_only",
        sourceCtx,
        targetCtx,
      });
      if (!validation.ok) {
        res
          .status(400)
          .json({ error: "invalid_input", message: validation.message });
        return;
      }
    }

    // Apply update (and create reclass if accepting) atomically.
    const txResult = await db.transaction(async (tx) => {
      // Re-check inside the transaction to close the race window between
      // pre-validation and the update: another concurrent request might
      // have already accepted this suggestion. We do a SELECT … FOR UPDATE
      // by using a conditional UPDATE with a where-clause on status.
      const [updated] = await tx
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
        .where(
          and(
            eq(annualReportReclassificationSuggestionsTable.id, suggestionId),
            // Only allow accept if the row is still in a non-final state.
            // For other transitions there's no such constraint.
            parsed.data.status === "accepted"
              ? inArray(
                  annualReportReclassificationSuggestionsTable.status,
                  ["suggested", "edited"],
                )
              : undefined,
          ),
        )
        .returning();

      if (!updated) {
        // Another writer beat us to it — abort.
        throw new Error("CONCURRENT_ACCEPT");
      }

      let createdReclass:
        | typeof annualReportReclassificationsTable.$inferSelect
        | null = null;

      if (parsed.data.status === "accepted" && targetCtx) {
        // Defence-in-depth: refuse to create a second active reclass for
        // the same suggestion. The status guard above should already
        // prevent this, but we double-check here in case a previous active
        // reclass exists from an earlier accept→undo→accept cycle.
        const existingActive = await tx
          .select({ id: annualReportReclassificationsTable.id })
          .from(annualReportReclassificationsTable)
          .where(
            and(
              eq(
                annualReportReclassificationsTable.sourceSuggestionId,
                suggestionId,
              ),
              eq(annualReportReclassificationsTable.status, "active"),
            ),
          );
        if (existingActive.length > 0) {
          throw new Error("DUPLICATE_ACTIVE_RECLASS");
        }

        const [inserted] = await tx
          .insert(annualReportReclassificationsTable)
          .values({
            reportId,
            sourceSuggestionId: suggestionId,
            sourceNoteRowId: existing.sourceNoteRowId ?? null,
            targetNoteRowId: targetCtx.rowId,
            sourceLabel: existing.sourceLabel ?? null,
            targetLabel: existing.targetLabel ?? null,
            amount: acceptedAmountStr ?? existing.suggestedAmount,
            effectType: existing.effectType,
            reason: existing.explanation ?? null,
            status: "active",
            createdByProfileId: profileId,
          })
          .returning();
        createdReclass = inserted;
      }

      return { updated, createdReclass };
    }).catch((err: unknown) => {
      if (err instanceof Error && err.message === "CONCURRENT_ACCEPT") {
        return { conflict: "concurrent" as const };
      }
      if (
        err instanceof Error &&
        err.message === "DUPLICATE_ACTIVE_RECLASS"
      ) {
        return { conflict: "duplicate" as const };
      }
      throw err;
    });

    if ("conflict" in txResult) {
      const message =
        txResult.conflict === "concurrent"
          ? "Förslaget hanterades av en annan användare medan din begäran behandlades."
          : "En aktiv omklassificering finns redan för det här förslaget.";
      res.status(409).json({
        error: "invalid_state_transition",
        message,
      });
      return;
    }

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

    if (txResult.createdReclass) {
      await logReclassificationAudit({
        reportId,
        eventType: "reclassification_created",
        actorProfileId: profileId,
        reclassificationId: txResult.createdReclass.id,
        suggestionId,
        payload: {
          sourceNoteRowId: txResult.createdReclass.sourceNoteRowId,
          targetNoteRowId: txResult.createdReclass.targetNoteRowId,
          amount: txResult.createdReclass.amount,
          effectType: txResult.createdReclass.effectType,
          appliedFrom: "suggestion_accept_atomic",
        },
      });
    }

    res.json(txResult.updated);
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

    // Resolve target row + note status.
    const targetCtx = await loadNoteRowContext(
      parsed.data.targetNoteRowId,
      reportId,
    );
    if (!targetCtx) {
      res.status(400).json({
        error: "invalid_input",
        message: "targetNoteRowId does not belong to this report",
      });
      return;
    }

    let sourceCtx: NoteRowContext | null = null;
    if (parsed.data.sourceNoteRowId) {
      sourceCtx = await loadNoteRowContext(
        parsed.data.sourceNoteRowId,
        reportId,
      );
      if (!sourceCtx) {
        res.status(400).json({
          error: "invalid_input",
          message: "sourceNoteRowId does not belong to this report",
        });
        return;
      }
    }

    const validation = await validateReclassification({
      reportId,
      amount: Number(parsed.data.amount),
      effectType: parsed.data.effectType,
      sourceCtx,
      targetCtx,
    });
    if (!validation.ok) {
      res.status(400).json({ error: "invalid_input", message: validation.message });
      return;
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
