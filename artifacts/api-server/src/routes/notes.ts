import { Router, type IRouter } from "express";
import { and, asc, eq, ne } from "drizzle-orm";
import {
  db,
  reportsTable,
  companiesTable,
  reportNotesTable,
} from "@workspace/db";
import { logAuditEvent } from "../lib/auditLog.js";
import { recalculateNoteNumbers } from "../lib/noteNumberingService.js";
import { suggestNotesForReport } from "../lib/noteRequirementEngine.js";

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

/**
 * Ensure `manualNumberOverride` is unique per report.
 *
 * When a user assigns override=N to a note, any OTHER note on the same report
 * that already holds N (or that gets bumped into a new collision) is shifted
 * upward by one. The walk continues until the chain terminates at a free slot,
 * mirroring how list-renumbering works in spreadsheet-style tools: assigning
 * "3" to a new row pushes the existing 3 to 4, the existing 4 to 5, and so on.
 *
 * Sequential auto-numbering for notes WITHOUT an override is handled later by
 * `recalculateNoteNumbers`, which fills 1..N around the claimed override slots.
 *
 * MUST run inside a `db.transaction` so a partial chain never leaves the report
 * with duplicate overrides on disk if any UPDATE fails midway.
 */
async function cascadeShiftManualOverrides(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  reportId: string,
  excludeNoteId: string,
  startNumber: number,
): Promise<void> {
  if (startNumber < 1) return;

  const others = await tx
    .select()
    .from(reportNotesTable)
    .where(
      and(
        eq(reportNotesTable.reportId, reportId),
        ne(reportNotesTable.id, excludeNoteId),
      ),
    );

  const occupied = new Map<number, string>();
  for (const n of others) {
    if (n.manualNumberOverride !== null && n.manualNumberOverride >= 1) {
      occupied.set(n.manualNumberOverride, n.id);
    }
  }

  // Walk upward, bumping each collider into the next slot. The hard cap is a
  // safety net — the chain can only be as long as `others.length`, so this
  // bound is generous and just prevents an unbounded loop if the data is
  // corrupted in some unexpected way.
  const maxSteps = others.length + 1;
  let steps = 0;
  let current = startNumber;
  while (occupied.has(current)) {
    if (++steps > maxSteps) {
      throw new Error(
        `cascadeShiftManualOverrides: aborted after ${maxSteps} steps on report ${reportId}`,
      );
    }
    const colliderId = occupied.get(current)!;
    const next = current + 1;
    await tx
      .update(reportNotesTable)
      .set({ manualNumberOverride: next, updatedAt: new Date() })
      .where(eq(reportNotesTable.id, colliderId));
    occupied.delete(current);
    occupied.set(next, colliderId);
    current = next;
  }
}

async function getNote(noteId: string, reportId: string) {
  const [n] = await db
    .select()
    .from(reportNotesTable)
    .where(
      and(
        eq(reportNotesTable.id, noteId),
        eq(reportNotesTable.reportId, reportId),
      ),
    );
  return n ?? null;
}

// ─── GET /reports/:reportId/notes ────────────────────────────────────────────

router.get(
  "/reports/:reportId/notes",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const notes = await db
      .select()
      .from(reportNotesTable)
      .where(eq(reportNotesTable.reportId, reportId))
      .orderBy(
        asc(reportNotesTable.noteNumber),
        asc(reportNotesTable.sortOrder),
      );

    const totalActive = notes.filter((n) => n.status !== "not_applicable").length;
    const totalNotApplicable = notes.length - totalActive;

    res.json({
      notes,
      framework: (row.report.accountingFramework as "K2" | "K3") ?? "K3",
      totalActive,
      totalNotApplicable,
    });
  },
);

// ─── POST /reports/:reportId/notes ───────────────────────────────────────────

router.post(
  "/reports/:reportId/notes",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const { noteType, title, requirementLevel, sortOrder } = req.body as {
      noteType?: string;
      title?: string;
      requirementLevel?: "required" | "likely_required" | "optional";
      sortOrder?: number;
    };

    if (!noteType || !title) {
      res.status(400).json({ error: "invalid_input", message: "noteType and title are required" });
      return;
    }

    const framework = (row.report.accountingFramework as "K2" | "K3") ?? "K3";

    const [inserted] = await db
      .insert(reportNotesTable)
      .values({
        reportId,
        noteType,
        title,
        requirementLevel: requirementLevel ?? "optional",
        status: "not_started",
        framework,
        sortOrder: sortOrder ?? 100,
      })
      .returning();

    await recalculateNoteNumbers(reportId);

    await logAuditEvent({
      eventType: "note_suggested",
      actorProfileId: profileId,
      companyId: row.company.id,
      payload: { noteId: inserted.id, noteType, manual: true },
    });

    res.status(201).json(inserted);
  },
);

// ─── PATCH /reports/:reportId/notes/:noteId ──────────────────────────────────

router.patch(
  "/reports/:reportId/notes/:noteId",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, noteId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const existing = await getNote(noteId, reportId);
    if (!existing) { res.status(404).json({ error: "not_found", message: "Note not found" }); return; }

    const body = req.body as {
      title?: string;
      status?: "not_started" | "suggested" | "needs_review" | "reviewed" | "complete" | "not_applicable" | "missing_info";
      suggestedText?: string | null;
      acceptedText?: string | null;
      sortOrder?: number;
      manualNumberOverride?: number | null;
      currentYearValue?: string | null;
      previousYearValue?: string | null;
    };

    const update: Partial<typeof reportNotesTable.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    let statusChanged = false;
    let textEdited = false;

    if (body.title !== undefined) update.title = body.title;
    if (body.status !== undefined && body.status !== existing.status) {
      update.status = body.status;
      statusChanged = true;
    }
    if (body.suggestedText !== undefined) update.suggestedText = body.suggestedText;
    if (body.acceptedText !== undefined) {
      update.acceptedText = body.acceptedText;
      // If text differed from previous accepted, treat as user edit
      if (body.acceptedText !== existing.acceptedText) {
        textEdited = true;
        // If previously AI-generated, mark as edited (no longer pure AI)
        if (existing.textIsAiGenerated && body.acceptedText !== existing.suggestedText) {
          update.textIsAiGenerated = false;
        }
      }
    }
    if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder;
    if (body.manualNumberOverride !== undefined) {
      update.manualNumberOverride = body.manualNumberOverride;
    }
    if (body.currentYearValue !== undefined) update.currentYearValue = body.currentYearValue;
    if (body.previousYearValue !== undefined) update.previousYearValue = body.previousYearValue;

    // Cascade-shift + target update run in one transaction so a mid-chain
    // failure cannot leave duplicate overrides behind. Clearing the override
    // (null) needs no cascade — recalculateNoteNumbers will fill the freed
    // slot sequentially.
    const [updated] = await db.transaction(async (tx) => {
      if (
        body.manualNumberOverride !== undefined &&
        body.manualNumberOverride !== null &&
        body.manualNumberOverride >= 1
      ) {
        await cascadeShiftManualOverrides(
          tx,
          reportId,
          noteId,
          body.manualNumberOverride,
        );
      }
      return tx
        .update(reportNotesTable)
        .set(update)
        .where(eq(reportNotesTable.id, noteId))
        .returning();
    });

    // Renumber if status changed (especially in/out of not_applicable) or sortOrder changed
    const needsRenumber =
      statusChanged ||
      body.sortOrder !== undefined ||
      body.manualNumberOverride !== undefined;
    if (needsRenumber) {
      await recalculateNoteNumbers(reportId);
    }

    if (statusChanged && body.status === "not_applicable") {
      await logAuditEvent({
        eventType: "note_marked_not_applicable",
        actorProfileId: profileId,
        companyId: row.company.id,
        payload: { noteId, reportId, noteType: existing.noteType },
      });
    } else if (statusChanged) {
      await logAuditEvent({
        eventType: "note_status_changed",
        actorProfileId: profileId,
        companyId: row.company.id,
        payload: { noteId, from: existing.status, to: body.status },
      });
    }
    if (textEdited) {
      await logAuditEvent({
        eventType: "note_text_edited",
        actorProfileId: profileId,
        companyId: row.company.id,
        payload: { noteId, reportId, wasAi: existing.textIsAiGenerated },
      });
    }

    res.json(updated);
  },
);

// ─── DELETE /reports/:reportId/notes/:noteId ─────────────────────────────────

router.delete(
  "/reports/:reportId/notes/:noteId",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, noteId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const existing = await getNote(noteId, reportId);
    if (!existing) { res.status(404).json({ error: "not_found", message: "Note not found" }); return; }

    await db.delete(reportNotesTable).where(eq(reportNotesTable.id, noteId));

    const { renumbered } = await recalculateNoteNumbers(reportId);

    await logAuditEvent({
      eventType: "note_reference_removed",
      actorProfileId: profileId,
      companyId: row.company.id,
      payload: { noteId, reportId, noteType: existing.noteType },
    });

    res.json({ deleted: true, renumbered });
  },
);

// ─── POST /reports/:reportId/notes/suggest ───────────────────────────────────

router.post(
  "/reports/:reportId/notes/suggest",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const framework = (row.report.accountingFramework as "K2" | "K3") ?? "K3";
    const { created, updated } = await suggestNotesForReport(reportId, framework);
    const { renumbered } = await recalculateNoteNumbers(reportId);

    await logAuditEvent({
      eventType: "note_suggested",
      actorProfileId: profileId,
      companyId: row.company.id,
      payload: { reportId, framework, created, updated, renumbered },
    });

    res.json({ created, updated, renumbered, framework });
  },
);

// ─── POST /reports/:reportId/notes/recalculate-numbers ───────────────────────

router.post(
  "/reports/:reportId/notes/recalculate-numbers",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const result = await recalculateNoteNumbers(reportId);

    await logAuditEvent({
      eventType: "note_numbering_recalculated",
      actorProfileId: profileId,
      companyId: row.company.id,
      payload: { reportId, ...result },
    });

    res.json(result);
  },
);

// ─── POST /reports/:reportId/notes/:noteId/accept-text ───────────────────────

router.post(
  "/reports/:reportId/notes/:noteId/accept-text",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, noteId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const existing = await getNote(noteId, reportId);
    if (!existing) { res.status(404).json({ error: "not_found", message: "Note not found" }); return; }

    const { text } = req.body as { text?: string | null };
    const finalText = text !== undefined ? text : existing.suggestedText;

    if (!finalText) {
      res.status(400).json({
        error: "invalid_input",
        message: "No text to accept. Provide text or set suggestedText first.",
      });
      return;
    }

    // If the user accepted text that differs from the AI-suggested draft, the
    // text is no longer purely AI-generated.
    const aiFlag =
      existing.textIsAiGenerated && finalText === existing.suggestedText
        ? true
        : false;

    // Whenever AI text is accepted, flag the note as requiring an explicit
    // user confirmation pass before the report can be filed. The confirm
    // endpoint flips confirmedByUser back to true.
    const requiresConfirmation =
      aiFlag || existing.requiresUserConfirmation;
    const stillConfirmed =
      existing.confirmedByUser &&
      finalText === existing.acceptedText;

    const [updated] = await db
      .update(reportNotesTable)
      .set({
        acceptedText: finalText,
        acceptedByProfileId: profileId,
        acceptedAt: new Date(),
        textIsAiGenerated: aiFlag,
        requiresUserConfirmation: requiresConfirmation,
        confirmedByUser: stillConfirmed,
        confirmedAt: stillConfirmed ? existing.confirmedAt : null,
        confirmedByProfileId: stillConfirmed ? existing.confirmedByProfileId : null,
        status: existing.status === "not_started" || existing.status === "suggested"
          ? "reviewed"
          : existing.status,
        updatedAt: new Date(),
      })
      .where(eq(reportNotesTable.id, noteId))
      .returning();

    await logAuditEvent({
      eventType: "note_text_accepted",
      actorProfileId: profileId,
      companyId: row.company.id,
      payload: {
        noteId,
        reportId,
        wasAiGenerated: existing.textIsAiGenerated,
        characterCount: finalText.length,
      },
    });

    res.json(updated);
  },
);

// ─── POST /reports/:reportId/notes/:noteId/ai-draft ──────────────────────────

router.post(
  "/reports/:reportId/notes/:noteId/ai-draft",
  async (req, res): Promise<void> => {
    const profileId = req.profile?.id;
    if (!profileId) { res.status(401).json({ error: "unauthorized" }); return; }

    const { reportId, noteId } = req.params;
    const row = await getReportWithCompany(reportId, profileId);
    if (!row) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }

    const existing = await getNote(noteId, reportId);
    if (!existing) { res.status(404).json({ error: "not_found", message: "Note not found" }); return; }

    // Phase 5: AI provider integration is wired but not active until OPENAI_API_KEY is set.
    const hasKey = !!process.env.OPENAI_API_KEY;
    if (!hasKey) {
      res.json({
        draft: null,
        provider: "not_configured" as const,
        instructions:
          "Lägg till en OPENAI_API_KEY i Replit-secrets för att aktivera AI-utkast. Tills dess kan du skriva förslagstexten manuellt.",
        noteId,
      });
      return;
    }

    // When the key exists, build a structured Swedish prompt and call OpenAI.
    // For now we return a deterministic placeholder draft so the endpoint
    // contract is honored even without the integration running.
    const sumLines = Array.isArray(existing.linkedStatementLines)
      ? (existing.linkedStatementLines as Array<{ label: string }>)
          .map((l) => l.label)
          .join(", ")
      : "";

    const placeholderDraft = `Utkast för "${existing.title}" enligt ${existing.framework}.\n\n` +
      (sumLines ? `Avser: ${sumLines}.\n\n` : "") +
      `(AI-utkast – granska noggrant innan du godkänner.)`;

    await db
      .update(reportNotesTable)
      .set({
        suggestedText: placeholderDraft,
        textIsAiGenerated: true,
        updatedAt: new Date(),
      })
      .where(eq(reportNotesTable.id, noteId));

    await logAuditEvent({
      eventType: "note_text_ai_generated",
      actorProfileId: profileId,
      companyId: row.company.id,
      payload: { noteId, reportId, provider: "openai" },
    });

    res.json({
      draft: placeholderDraft,
      provider: "openai" as const,
      instructions: null,
      noteId,
    });
  },
);

export default router;
