/**
 * Annual report export endpoints (Phase 6.6 + Phase 7).
 *
 * All endpoints are mounted under `/api`. They accept a `reportId` URL
 * parameter and resolve the matching project (when one exists) for
 * entitlement, demo, audit, and export-history operations.
 *
 *   GET  /reports/:reportId/export/data
 *   GET  /reports/:reportId/export/readiness
 *   POST /reports/:reportId/export/cover
 *   POST /reports/:reportId/export/pdf
 *   POST /reports/:reportId/export/word
 *   GET  /reports/:reportId/export/history
 *
 * The same surface is also reachable under
 *   /projects/:projectId/export/* (resolved through resolveReportForProject).
 *
 * SECURITY: requireAuth is applied via routes/index.ts.
 *           - Every endpoint requires the report to have a paired project
 *             row; reports without one return 409 (no_project).
 *           - Read endpoints require canViewProject.
 *           - Generate endpoints require canExportProject (owner role).
 *           - Real (non-watermarked) generation additionally requires
 *             hasPaidProjectEntitlement.
 *           - Demo projects always produce watermarked exports.
 */

import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { eq, and, desc, ne } from "drizzle-orm";
import {
  db,
  exportFilesTable,
  annualReportProjectsTable,
  auditEventsTable,
  projectFilesTable,
} from "@workspace/db";
import {
  type ExportHistoryEntry,
  type ExportSnapshotSummary,
  type ExportPackageOptions,
} from "@workspace/export-contract";
import { buildAnnualReportExportData } from "../lib/exportDataBuilder.js";
import { buildExportReadiness } from "../lib/exportReadiness.js";
// (re-imported above) — used by both the readiness route and the generate path.
import { renderAnnualReportPdf } from "../lib/pdfRenderer.js";
import { renderAnnualReportWord } from "../lib/wordRenderer.js";
import {
  renderValidationSummaryPdf,
  renderAuditSummaryPdf,
} from "../lib/exportPackageRenderer.js";
import {
  resolveProjectForReport,
  resolveReportForProject,
} from "../helpers/projectReportLink.js";
import {
  canExportProject,
  canViewProject,
  hasPaidProjectEntitlement,
} from "../helpers/permissions.js";
import {
  isDemoProject,
  isKnownDemoProjectId,
  mustWatermark,
  buildStoragePath,
} from "../helpers/demo.js";
import { logAuditEvent, AUDIT_EVENTS } from "../helpers/auditLog.js";
import { getSupabaseAdmin } from "../lib/supabase.js";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Common gate
// ---------------------------------------------------------------------------

/**
 * Resolve auth + project for a report-scoped export endpoint.
 * Sends a 401/404 response and returns null when access is not allowed.
 */
async function gateForReport(
  req: import("express").Request,
  res: import("express").Response,
  opts: { requireExport?: boolean } = {},
) {
  const profileId: string | undefined = req.user?.profileId ?? req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  const reportId = String(req.params.reportId ?? "");
  if (!reportId) {
    res.status(400).json({ error: "invalid_input", message: "reportId required" });
    return null;
  }
  const link = await resolveProjectForReport(reportId);
  if (!link) {
    res.status(404).json({ error: "not_found", message: "Report not found" });
    return null;
  }
  // Authorization is mandatory. Export endpoints always require a paired
  // project row (entitlement, demo flag, role, and audit trail all live
  // there). A report without a project row is not exportable — fail closed
  // rather than leak data through a permissive fallback.
  if (!link.projectId) {
    res.status(409).json({
      error: "no_project",
      message:
        "This report has no paired project row — exports are unavailable.",
    });
    return null;
  }
  const projectId: string = link.projectId;
  const allowed = opts.requireExport
    ? await canExportProject(profileId, projectId)
    : await canViewProject(profileId, projectId);
  if (!allowed) {
    res.status(403).json({
      error: "forbidden",
      message: opts.requireExport
        ? "Owner role required to export this report."
        : "Project access required.",
    });
    return null;
  }
  return { profileId, reportId, projectId, link: { ...link, projectId } };
}

// ---------------------------------------------------------------------------
// GET /reports/:reportId/export/data
// ---------------------------------------------------------------------------

router.get("/reports/:reportId/export/data", async (req, res): Promise<void> => {
  const ctx = await gateForReport(req, res);
  if (!ctx) return;

  const data = await buildAnnualReportExportData(ctx.reportId);
  if (!data) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  // Resolve a signed download URL for the uploaded cover, when present, so
  // the preview can render a thumbnail / acknowledge the upload. The actual
  // PDF first-page merging is a documented Phase 8 limitation — see
  // `docs/export-implementation.md`.
  //
  // SECURITY: We must constrain the project_files lookup to *this project*
  // so a user with edit rights on project A cannot point `coverUploadedFileId`
  // at a file from project B and exfiltrate a signed URL via the admin
  // storage credentials. The same constraint is also enforced at write-time
  // in `/export/cover`.
  if (
    data.cover.mode === "uploaded" &&
    data.cover.uploadedFileId &&
    ctx.projectId
  ) {
    try {
      const supa = getSupabaseAdmin();
      if (supa) {
        const { data: fileRow } = await supa
          .from("project_files" as never)
          .select("storage_bucket, storage_path, project_id")
          .eq("id", data.cover.uploadedFileId as never)
          .eq("project_id", ctx.projectId as never)
          .single();
        if (fileRow) {
          const { data: signed } = await supa.storage
            .from((fileRow as { storage_bucket: string }).storage_bucket)
            .createSignedUrl((fileRow as { storage_path: string }).storage_path, 3600);
          if (signed?.signedUrl) {
            data.cover.uploadedFileUrl = signed.signedUrl;
          }
        } else {
          req.log.warn(
            { fileId: data.cover.uploadedFileId, projectId: ctx.projectId },
            "Cover uploadedFileId does not belong to this project — ignoring",
          );
        }
      }
    } catch (err) {
      req.log.warn({ err }, "Could not resolve uploaded cover URL — preview will fall back");
    }
  }
  await logAuditEvent({
    eventType: AUDIT_EVENTS.EXPORT_PREVIEW_VIEWED,
    projectId: ctx.projectId,
    actorProfileId: ctx.profileId,
    eventData: {
      reportId: ctx.reportId,
      framework: data.company.framework,
      noteCount: data.notes.length,
      watermark: data.watermark.show,
    },
  });
  res.json(data);
});

// ---------------------------------------------------------------------------
// GET /reports/:reportId/export/readiness
// ---------------------------------------------------------------------------

router.get(
  "/reports/:reportId/export/readiness",
  async (req, res): Promise<void> => {
    const ctx = await gateForReport(req, res);
    if (!ctx) return;
    const readiness = await buildExportReadiness(ctx.reportId, ctx.profileId);
    await logAuditEvent({
      eventType: AUDIT_EVENTS.EXPORT_READINESS_CHECKED,
      projectId: ctx.projectId,
      actorProfileId: ctx.profileId,
      eventData: { reportId: ctx.reportId, level: readiness.level },
    });
    res.json(readiness);
  },
);

// ---------------------------------------------------------------------------
// POST /reports/:reportId/export/cover
// ---------------------------------------------------------------------------

router.post(
  "/reports/:reportId/export/cover",
  async (req, res): Promise<void> => {
    const ctx = await gateForReport(req, res, { requireExport: true });
    if (!ctx) return;
    if (!ctx.projectId) {
      res.status(409).json({
        error: "no_project",
        message: "This report has no paired project — cover settings unavailable.",
      });
      return;
    }
    const body = req.body as {
      mode?: string;
      title?: string | null;
      subtitle?: string | null;
      logoUrl?: string | null;
      uploadedFileId?: string | null;
    };
    const allowedModes = new Set(["auto", "logo", "uploaded"]);
    if (body.mode && !allowedModes.has(body.mode)) {
      res.status(400).json({
        error: "invalid_input",
        message: "mode must be auto|logo|uploaded",
      });
      return;
    }

    // SECURITY: when an `uploadedFileId` is supplied, verify it belongs to
    // *this* project. Otherwise a user with edit rights on project A could
    // attach a file id from project B and later receive a signed download
    // URL for it via `/export/data`.
    if (body.uploadedFileId) {
      const [own] = await db
        .select({ id: projectFilesTable.id })
        .from(projectFilesTable)
        .where(
          and(
            eq(projectFilesTable.id, body.uploadedFileId),
            eq(projectFilesTable.projectId, ctx.projectId),
          ),
        )
        .limit(1);
      if (!own) {
        res.status(400).json({
          error: "invalid_input",
          message: "uploadedFileId does not belong to this project",
        });
        return;
      }
    }

    // Read the previous row so we can emit "added" vs "removed" vs
    // "updated" audit events for the cover sheet upload lifecycle (spec §15).
    const [prev] = await db
      .select({
        coverMode: annualReportProjectsTable.coverMode,
        coverUploadedFileId: annualReportProjectsTable.coverUploadedFileId,
      })
      .from(annualReportProjectsTable)
      .where(eq(annualReportProjectsTable.id, ctx.projectId))
      .limit(1);

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (body.mode !== undefined) update.coverMode = body.mode;
    if (body.title !== undefined) update.coverTitle = body.title;
    if (body.subtitle !== undefined) update.coverSubtitle = body.subtitle;
    if (body.logoUrl !== undefined) update.coverLogoUrl = body.logoUrl;
    if (body.uploadedFileId !== undefined) update.coverUploadedFileId = body.uploadedFileId;

    await db
      .update(annualReportProjectsTable)
      .set(update)
      .where(eq(annualReportProjectsTable.id, ctx.projectId));

    // Always emit the legacy "updated" event for the audit timeline.
    await logAuditEvent({
      eventType: AUDIT_EVENTS.EXPORT_COVER_UPDATED,
      projectId: ctx.projectId,
      actorProfileId: ctx.profileId,
      eventData: { reportId: ctx.reportId, ...body },
    });
    // Emit added / removed when the upload reference changes.
    const prevId = prev?.coverUploadedFileId ?? null;
    const nextId =
      body.uploadedFileId !== undefined ? body.uploadedFileId : prevId;
    if (prevId !== nextId) {
      await logAuditEvent({
        eventType:
          nextId !== null
            ? AUDIT_EVENTS.COVER_SHEET_ADDED
            : AUDIT_EVENTS.COVER_SHEET_REMOVED,
        projectId: ctx.projectId,
        actorProfileId: ctx.profileId,
        eventData: { reportId: ctx.reportId, fileId: nextId, previousFileId: prevId },
      });
    }

    res.json({ ok: true });
  },
);

// ---------------------------------------------------------------------------
// POST /reports/:reportId/export/pdf and /word
// ---------------------------------------------------------------------------

router.post("/reports/:reportId/export/pdf", async (req, res): Promise<void> => {
  await generateExport(req, res, "pdf");
});
router.post("/reports/:reportId/export/word", async (req, res): Promise<void> => {
  await generateExport(req, res, "word");
});

async function generateExport(
  req: import("express").Request,
  res: import("express").Response,
  format: "pdf" | "word",
) {
  const ctx = await gateForReport(req, res, { requireExport: true });
  if (!ctx) return;

  const data = await buildAnnualReportExportData(ctx.reportId);
  if (!data) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  // Always honour server-side watermark policy. For the known demo project,
  // mustWatermark() returns true unconditionally.
  const isDemo =
    isKnownDemoProjectId(ctx.projectId) ||
    (await isDemoProject(ctx.projectId));
  const isPaid = await hasPaidProjectEntitlement(ctx.projectId);
  const watermark = mustWatermark(isDemo, isPaid);

  // Compute the real readiness verdict so the snapshot summary reflects
  // what the user saw at export time (not hardcoded zeros). The readiness
  // call itself runs the validation engine + note-numbering + reference +
  // reclassification checks; we surface those as discrete audit events so
  // an external audit trail can see that each gate was evaluated before
  // the export attempt (spec §15).
  const readiness = await buildExportReadiness(ctx.reportId, ctx.profileId);
  await Promise.all([
    logAuditEvent({
      eventType: AUDIT_EVENTS.FINAL_VALIDATION_RUN,
      projectId: ctx.projectId,
      actorProfileId: ctx.profileId,
      eventData: { reportId: ctx.reportId, level: readiness.level },
    }),
    logAuditEvent({
      eventType: AUDIT_EVENTS.NOTE_NUMBERING_CHECKED,
      projectId: ctx.projectId,
      actorProfileId: ctx.profileId,
      eventData: { reportId: ctx.reportId },
    }),
    logAuditEvent({
      eventType: AUDIT_EVENTS.NOTE_REFERENCES_CHECKED,
      projectId: ctx.projectId,
      actorProfileId: ctx.profileId,
      eventData: { reportId: ctx.reportId },
    }),
    logAuditEvent({
      eventType: AUDIT_EVENTS.NOTE_TOTALS_CHECKED,
      projectId: ctx.projectId,
      actorProfileId: ctx.profileId,
      eventData: { reportId: ctx.reportId },
    }),
    logAuditEvent({
      eventType: AUDIT_EVENTS.RECLASS_NETTING_CHECKED,
      projectId: ctx.projectId,
      actorProfileId: ctx.profileId,
      eventData: { reportId: ctx.reportId },
    }),
  ]);
  if (!watermark && !readiness.canExportFinal) {
    await logAuditEvent({
      eventType: AUDIT_EVENTS.EXPORT_BLOCKED,
      projectId: ctx.projectId,
      actorProfileId: ctx.profileId,
      eventData: {
        reportId: ctx.reportId,
        format,
        blockingCodes: readiness.items
          .filter((i) => i.level === "blocking")
          .map((i) => i.code),
      },
    });
    res.status(409).json({
      error: "blocked",
      message: "Export is blocked because required issues remain.",
      readiness,
    });
    return;
  }
  const blockingCount = readiness.items.filter((i) => i.level === "blocking").length;
  const warningCount = readiness.items.filter((i) => i.level === "warning").length;
  data.watermark = {
    show: watermark,
    reason: !watermark ? null : isDemo ? "demo" : "unpaid",
    text: data.watermark.text,
  };

  // ── Cover-sheet bytes resolution (Phase 8) ────────────────────────────
  // When the project is in "uploaded" cover mode and points at a real
  // project_files row that we own, download the bytes from storage and
  // hand them to the renderer so the upload becomes the literal first
  // page (PDF) or full-page cover image (PDF/Word).
  //
  // We do this here rather than in `exportDataBuilder` so that:
  //   - renderers stay pure functions of (data, optional override) and
  //     don't depend on Supabase being reachable;
  //   - the audit event `export.cover_merged` can be emitted with
  //     accurate "did we actually splice it?" semantics.
  let coverOverride: { bytes: Buffer; mimeType: string } | null = null;
  if (
    data.cover.mode === "uploaded" &&
    data.cover.uploadedFileId &&
    ctx.projectId
  ) {
    try {
      const supa = getSupabaseAdmin();
      if (supa) {
        const { data: fileRow } = await supa
          .from("project_files" as never)
          .select("storage_bucket, storage_path, mime_type, project_id")
          .eq("id", data.cover.uploadedFileId as never)
          .eq("project_id", ctx.projectId as never)
          .single();
        if (fileRow) {
          const row = fileRow as {
            storage_bucket: string;
            storage_path: string;
            mime_type: string;
          };
          const { data: blob } = await supa.storage
            .from(row.storage_bucket)
            .download(row.storage_path);
          if (blob) {
            const ab = await blob.arrayBuffer();
            coverOverride = {
              bytes: Buffer.from(ab),
              mimeType: row.mime_type,
            };
          }
        }
      }
    } catch (err) {
      req.log.warn({ err }, "Could not resolve uploaded cover bytes — falling back to auto cover");
    }
  }

  let bytes: Buffer;
  let mimeType: string;
  let extension: string;
  // The renderer is the source of truth for whether the override was
  // actually embedded/spliced. Do NOT infer this from "did we pass an
  // override?" — image-decode fallbacks and PDF-in-Word both deliberately
  // return coverMerged=false even though an override was supplied.
  let coverMerged = false;
  try {
    if (format === "pdf") {
      const result = await renderAnnualReportPdf(data, coverOverride);
      bytes = result.bytes;
      coverMerged = result.coverMerged;
      mimeType = "application/pdf";
      extension = "pdf";
    } else {
      const result = await renderAnnualReportWord(data, coverOverride);
      bytes = result.bytes;
      coverMerged = result.coverMerged;
      mimeType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      extension = "docx";
    }
  } catch (err) {
    req.log.error({ err, reportId: ctx.reportId, format }, "Export render failed");
    await logAuditEvent({
      eventType: AUDIT_EVENTS.EXPORT_FAILED,
      projectId: ctx.projectId,
      actorProfileId: ctx.profileId,
      eventData: {
        reportId: ctx.reportId,
        format,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    res.status(500).json({ error: "render_failed", message: "Could not render export." });
    return;
  }

  const fileId = randomUUID();
  const safeName = `${data.company.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "arsredovisning"}_${
    new Date(data.period.end).getUTCFullYear()
  }.${extension}`;
  const bucket = isDemo ? "demo-assets" : "exports";
  const storagePath = buildStoragePath(ctx.projectId, fileId, safeName);

  // Try to upload to Supabase Storage. If unavailable, fall back to a
  // deterministic in-memory cache that the download endpoint can serve.
  const supabase = getSupabaseAdmin();
  let uploaded = false;
  if (supabase) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, bytes, { contentType: mimeType, upsert: true });
      if (error) {
        req.log.warn({ err: error.message, bucket, storagePath }, "Supabase upload failed — falling back to in-memory cache");
      } else {
        uploaded = true;
      }
    } catch (err) {
      req.log.warn({ err }, "Supabase upload threw — falling back to in-memory cache");
    }
  }
  if (!uploaded) cacheExportBytes(fileId, bytes, mimeType);

  const summary: ExportSnapshotSummary = {
    fiscalYearLabel: data.period.label,
    noteCount: data.notes.length,
    statementLineCount: data.statements.reduce((n, s) => n + s.lines.length, 0),
    blockingIssues: blockingCount,
    warningIssues: warningCount,
    watermark,
    framework: data.company.framework,
  };

  const [exportRow] = await db
    .insert(exportFilesTable)
    .values({
      projectId: ctx.projectId,
      generatedByProfileId: ctx.profileId,
      storageBucket: bucket,
      storagePath,
      originalFilename: safeName,
      mimeType,
      fileSize: bytes.byteLength,
      format,
      exportStatus: "completed",
      watermark,
      snapshotSummary: summary,
      label: format === "pdf" ? "Årsredovisning – PDF" : "Årsredovisning – Word",
    })
    .returning();
  // Re-key the cached bytes under the actual db-generated id so the download
  // route can find them.
  if (!supabase || !uploaded) {
    cacheExportBytes(exportRow.id, bytes, mimeType);
  }
  void fileId;

  // Emit both the legacy "generated" event (kept for back-compat with the
  // existing audit timeline UI) and the new format-specific events required
  // by spec §15.
  await Promise.all([
    logAuditEvent({
      eventType: AUDIT_EVENTS.EXPORT_GENERATED,
      projectId: ctx.projectId,
      actorProfileId: ctx.profileId,
      eventData: {
        reportId: ctx.reportId,
        exportId: exportRow.id,
        format,
        watermark,
        bytes: bytes.byteLength,
      },
    }),
    logAuditEvent({
      eventType:
        format === "pdf"
          ? AUDIT_EVENTS.EXPORT_PDF_CREATED
          : AUDIT_EVENTS.EXPORT_WORD_CREATED,
      projectId: ctx.projectId,
      actorProfileId: ctx.profileId,
      eventData: {
        reportId: ctx.reportId,
        exportId: exportRow.id,
        watermark,
        bytes: bytes.byteLength,
      },
    }),
    // Phase 8: emit `export.cover_merged` only when the upload was actually
    // spliced into the rendered output (PDF first-page splice or full-page
    // image embed). PDF covers in Word do NOT count — see wordRenderer's
    // pdfNotice path.
    ...(coverMerged && coverOverride && data.cover.uploadedFileId
      ? [
          logAuditEvent({
            eventType: AUDIT_EVENTS.EXPORT_COVER_MERGED,
            projectId: ctx.projectId,
            actorProfileId: ctx.profileId,
            eventData: {
              reportId: ctx.reportId,
              exportId: exportRow.id,
              format,
              coverFileId: data.cover.uploadedFileId,
              coverMimeType: coverOverride.mimeType,
            },
          }),
        ]
      : []),
  ]);

  // Mark the project as "exported" the first time a non-watermarked export
  // succeeds. The transition uses a single conditional UPDATE so two
  // concurrent successful exports cannot both observe the pre-transition
  // state and both emit `project.marked_exported`. The audit event only
  // fires when the row was actually flipped.
  if (!watermark) {
    const flipped = await db
      .update(annualReportProjectsTable)
      .set({ status: "exported", updatedAt: new Date() })
      .where(
        and(
          eq(annualReportProjectsTable.id, ctx.projectId),
          // Only flip if not already "exported" — atomic compare-and-set.
          ne(annualReportProjectsTable.status, "exported"),
        ),
      )
      .returning({ id: annualReportProjectsTable.id });
    if (flipped.length > 0) {
      await logAuditEvent({
        eventType: AUDIT_EVENTS.PROJECT_MARKED_EXPORTED,
        projectId: ctx.projectId,
        actorProfileId: ctx.profileId,
        eventData: {
          reportId: ctx.reportId,
          exportId: exportRow.id,
          format,
        },
      });
    }
  }

  res.json({
    exportId: exportRow.id,
    format,
    filename: safeName,
    mimeType,
    fileSize: bytes.byteLength,
    watermark,
    downloadUrl: `/api/projects/${ctx.projectId}/exports/${exportRow.id}/download`,
  });
}

// ---------------------------------------------------------------------------
// POST /reports/:reportId/export/package
// ---------------------------------------------------------------------------
//
// Generates the formal report (PDF or Word) plus optional appendices and
// links them via a shared `packageId` in `export_files`. The download UI
// presents the package as a single grouping in the history list.
//
// Body shape: ExportPackageOptions (see @workspace/export-contract).
// ---------------------------------------------------------------------------

router.post(
  "/reports/:reportId/export/package",
  async (req, res): Promise<void> => {
    const ctx = await gateForReport(req, res);
    if (!ctx) return;
    if (!ctx.projectId) {
      res.status(409).json({ error: "no_project_link" });
      return;
    }
    const opts = (req.body ?? {}) as ExportPackageOptions;
    if (opts.format !== "pdf" && opts.format !== "word") {
      res.status(400).json({ error: "invalid_input", message: "format must be pdf|word" });
      return;
    }

    // Step 1 — generate the primary report by calling the same code path the
    // PDF/Word endpoints use. We collect the response and pull out the
    // export id so we can group appendices under the same packageId.
    const captureRes = makeCaptureRes();
    await generateExport(req, captureRes as unknown as typeof res, opts.format);
    if (captureRes.statusCode && captureRes.statusCode >= 400) {
      res.status(captureRes.statusCode).json(captureRes.body);
      return;
    }
    const primary = captureRes.body as {
      exportId: string;
      filename: string;
      watermark: boolean;
      fileSize: number;
    };

    const packageId = randomUUID();
    await db
      .update(exportFilesTable)
      .set({ packageId })
      .where(eq(exportFilesTable.id, primary.exportId));

    // Step 2 — appendices.
    const appendixIds: string[] = [];
    const data = await buildAnnualReportExportData(ctx.reportId);
    if (!data) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (opts.includeValidationSummary) {
      const readiness = await buildExportReadiness(ctx.reportId, ctx.profileId);
      const bytes = await renderValidationSummaryPdf(readiness, {
        companyName: data.company.name,
        periodLabel: data.period.label,
      });
      const id = await persistAppendix({
        ctx,
        bytes,
        filename: "valideringssammanstallning.pdf",
        mimeType: "application/pdf",
        label: "Valideringssammanställning",
        packageId,
      });
      appendixIds.push(id);
    }
    if (opts.includeAuditSummary) {
      const events = await db
        .select({
          createdAt: auditEventsTable.createdAt,
          eventType: auditEventsTable.eventType,
          actorProfileId: auditEventsTable.actorProfileId,
          eventData: auditEventsTable.eventData,
        })
        .from(auditEventsTable)
        .where(eq(auditEventsTable.projectId, ctx.projectId))
        .orderBy(desc(auditEventsTable.createdAt))
        .limit(500);
      const bytes = await renderAuditSummaryPdf(
        events.map((e) => ({
          createdAt: e.createdAt,
          eventType: e.eventType,
          actorProfileId: e.actorProfileId,
          eventData: e.eventData,
        })),
        { companyName: data.company.name, periodLabel: data.period.label },
      );
      const id = await persistAppendix({
        ctx,
        bytes,
        filename: "andringshistorik.pdf",
        mimeType: "application/pdf",
        label: "Ändringshistorik",
        packageId,
      });
      appendixIds.push(id);
    }

    await logAuditEvent({
      eventType: AUDIT_EVENTS.EXPORT_PACKAGE_CREATED,
      projectId: ctx.projectId,
      actorProfileId: ctx.profileId,
      eventData: {
        reportId: ctx.reportId,
        packageId,
        primaryExportId: primary.exportId,
        appendixIds,
        format: opts.format,
      },
    });

    res.json({
      packageId,
      primaryExportId: primary.exportId,
      appendixIds,
      filename: primary.filename,
      watermark: primary.watermark,
    });
  },
);

// ---------------------------------------------------------------------------
// GET /reports/:reportId/export/state — coarse project state badge
// ---------------------------------------------------------------------------

router.get(
  "/reports/:reportId/export/state",
  async (req, res): Promise<void> => {
    const ctx = await gateForReport(req, res);
    if (!ctx) return;
    if (!ctx.projectId) {
      res.json({ state: "blocked" });
      return;
    }
    const isDemo = await isDemoProject(ctx.projectId);
    const isPaid = await hasPaidProjectEntitlement(ctx.projectId);
    const [proj] = await db
      .select({ status: annualReportProjectsTable.status })
      .from(annualReportProjectsTable)
      .where(eq(annualReportProjectsTable.id, ctx.projectId))
      .limit(1);
    const readiness = await buildExportReadiness(ctx.reportId, ctx.profileId);
    let state: import("@workspace/export-contract").ProjectExportState;
    if (proj?.status === "exported") state = "already_exported";
    else if (isDemo) state = "demo";
    else if (!readiness.canExportFinal) state = "blocked";
    else if (isPaid) state = "paid";
    else state = "ready";
    res.json({ state, isDemo, isPaid });
  },
);

// Minimal capture shim — lets the package endpoint reuse the same generate
// pipeline as the dedicated PDF/Word endpoints without re-implementing it.
function makeCaptureRes(): {
  statusCode: number;
  body: unknown;
  status(code: number): { json(b: unknown): void };
  json(b: unknown): void;
} {
  const obj = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      obj.statusCode = code;
      return { json(b: unknown) { obj.body = b; } };
    },
    json(b: unknown) { obj.body = b; },
  };
  return obj;
}

async function persistAppendix(args: {
  ctx: { projectId: string; profileId: string };
  bytes: Buffer;
  filename: string;
  mimeType: string;
  label: string;
  packageId: string;
}): Promise<string> {
  const id = randomUUID();
  const bucket = "exports";
  const storagePath = buildStoragePath(args.ctx.projectId, id, args.filename);
  const supabase = getSupabaseAdmin();
  let uploaded = false;
  if (supabase) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, args.bytes, { contentType: args.mimeType, upsert: true });
    if (!error) uploaded = true;
  }
  if (!uploaded) cacheExportBytes(id, args.bytes, args.mimeType);
  const [row] = await db
    .insert(exportFilesTable)
    .values({
      projectId: args.ctx.projectId,
      generatedByProfileId: args.ctx.profileId,
      storageBucket: bucket,
      storagePath,
      originalFilename: args.filename,
      mimeType: args.mimeType,
      fileSize: args.bytes.byteLength,
      format: "pdf",
      exportStatus: "completed",
      watermark: false,
      label: args.label,
      packageId: args.packageId,
    })
    .returning();
  if (!uploaded) cacheExportBytes(row.id, args.bytes, args.mimeType);
  return row.id;
}

// ---------------------------------------------------------------------------
// GET /reports/:reportId/export/history
// ---------------------------------------------------------------------------

router.get(
  "/reports/:reportId/export/history",
  async (req, res): Promise<void> => {
    const ctx = await gateForReport(req, res);
    if (!ctx) return;
    if (!ctx.projectId) {
      res.json({ entries: [] });
      return;
    }
    const rows = await db
      .select()
      .from(exportFilesTable)
      .where(eq(exportFilesTable.projectId, ctx.projectId))
      .orderBy(desc(exportFilesTable.createdAt))
      .limit(50);

    const entries: ExportHistoryEntry[] = rows.map((r) => ({
      id: r.id,
      format: r.format as ExportHistoryEntry["format"],
      filename: r.originalFilename,
      watermark: r.watermark,
      exportStatus: r.exportStatus as ExportHistoryEntry["exportStatus"],
      fileSize: r.fileSize,
      generatedAt: r.createdAt.toISOString(),
      generatedByProfileId: r.generatedByProfileId,
      snapshotSummary:
        (r.snapshotSummary as ExportSnapshotSummary | null) ?? null,
      packageId: r.packageId ?? null,
      label: r.label ?? null,
    }));
    res.json({ entries });
  },
);

// ---------------------------------------------------------------------------
// Project-id mirrors of the same endpoints
//
// These accept a projectId and translate it to the matching reportId before
// re-issuing the request to the report-scoped handlers above. We do this by
// rewriting `req.url` and `req.params` and delegating to the same Express
// router via a fresh internal request — but to avoid re-entrancy hacks we
// just resolve and call the underlying functions inline.
// ---------------------------------------------------------------------------

router.get("/projects/:projectId/export/data", async (req, res): Promise<void> => {
  const link = await resolveReportForProject(String(req.params.projectId));
  if (!link) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  (req.params as Record<string, string>).reportId = link.reportId;
  const ctx = await gateForReport(req, res);
  if (!ctx) return;
  const data = await buildAnnualReportExportData(ctx.reportId);
  if (!data) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(data);
});

router.get(
  "/projects/:projectId/export/readiness",
  async (req, res): Promise<void> => {
    const link = await resolveReportForProject(String(req.params.projectId));
    if (!link) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    (req.params as Record<string, string>).reportId = link.reportId;
    const ctx = await gateForReport(req, res);
    if (!ctx) return;
    const readiness = await buildExportReadiness(ctx.reportId, ctx.profileId);
    res.json(readiness);
  },
);

router.get(
  "/projects/:projectId/export/history",
  async (req, res): Promise<void> => {
    const link = await resolveReportForProject(String(req.params.projectId));
    if (!link) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    (req.params as Record<string, string>).reportId = link.reportId;
    const ctx = await gateForReport(req, res);
    if (!ctx) return;
    if (!ctx.projectId) {
      res.json({ entries: [] });
      return;
    }
    const rows = await db
      .select()
      .from(exportFilesTable)
      .where(eq(exportFilesTable.projectId, ctx.projectId))
      .orderBy(desc(exportFilesTable.createdAt))
      .limit(50);
    const entries: ExportHistoryEntry[] = rows.map((r) => ({
      id: r.id,
      format: r.format as ExportHistoryEntry["format"],
      filename: r.originalFilename,
      watermark: r.watermark,
      exportStatus: r.exportStatus as ExportHistoryEntry["exportStatus"],
      fileSize: r.fileSize,
      generatedAt: r.createdAt.toISOString(),
      generatedByProfileId: r.generatedByProfileId,
      snapshotSummary:
        (r.snapshotSummary as ExportSnapshotSummary | null) ?? null,
      packageId: r.packageId ?? null,
      label: r.label ?? null,
    }));
    res.json({ entries });
  },
);

// ---------------------------------------------------------------------------
// In-memory cache for environments without Supabase (dev / preview)
// ---------------------------------------------------------------------------

interface CachedExport {
  bytes: Buffer;
  mimeType: string;
  expiresAt: number;
}
const exportCache = new Map<string, CachedExport>();

function cacheExportBytes(id: string, bytes: Buffer, mimeType: string) {
  exportCache.set(id, {
    bytes,
    mimeType,
    expiresAt: Date.now() + 60 * 60 * 1000,
  });
  // Best-effort eviction.
  for (const [k, v] of exportCache) {
    if (v.expiresAt < Date.now()) exportCache.delete(k);
  }
}

export function readCachedExportBytes(
  id: string,
): { bytes: Buffer; mimeType: string } | null {
  const c = exportCache.get(id);
  if (!c) return null;
  if (c.expiresAt < Date.now()) {
    exportCache.delete(id);
    return null;
  }
  return { bytes: c.bytes, mimeType: c.mimeType };
}

// Silence unused import warnings.
void and;

export default router;
