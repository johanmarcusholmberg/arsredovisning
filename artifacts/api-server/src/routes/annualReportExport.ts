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
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  exportFilesTable,
  annualReportProjectsTable,
} from "@workspace/db";
import {
  type ExportHistoryEntry,
  type ExportSnapshotSummary,
} from "@workspace/export-contract";
import { buildAnnualReportExportData } from "../lib/exportDataBuilder.js";
import { buildExportReadiness } from "../lib/exportReadiness.js";
// (re-imported above) — used by both the readiness route and the generate path.
import { renderAnnualReportPdf } from "../lib/pdfRenderer.js";
import { renderAnnualReportWord } from "../lib/wordRenderer.js";
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
  // The "uploaded" cover mode is contractually defined but not yet rendered
  // by the PDF/Word renderers. Coerce to "auto" so the preview, PDF, and
  // Word stay in lockstep until the upload-replacement pass ships.
  if (data.cover.mode === "uploaded") {
    data.cover.mode = "auto";
    data.cover.uploadedFileUrl = null;
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
    // "uploaded" is a future cover mode — accepted by the contract but not
    // yet honored by the renderers. Reject it explicitly so the data shown
    // in the preview always matches the bytes produced for PDF/Word.
    const allowedModes = new Set(["auto", "logo"]);
    if (body.mode && !allowedModes.has(body.mode)) {
      res.status(400).json({
        error: "invalid_input",
        message: "mode must be auto|logo (uploaded covers are not yet supported)",
      });
      return;
    }
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

    await logAuditEvent({
      eventType: AUDIT_EVENTS.EXPORT_COVER_UPDATED,
      projectId: ctx.projectId,
      actorProfileId: ctx.profileId,
      eventData: { reportId: ctx.reportId, ...body },
    });

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
  // what the user saw at export time (not hardcoded zeros).
  const readiness = await buildExportReadiness(ctx.reportId, ctx.profileId);
  if (!watermark && !readiness.canExportFinal) {
    res.status(409).json({
      error: "blocked",
      message: "Final export is blocked — resolve readiness items first.",
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

  let bytes: Buffer;
  let mimeType: string;
  let extension: string;
  try {
    if (format === "pdf") {
      bytes = await renderAnnualReportPdf(data);
      mimeType = "application/pdf";
      extension = "pdf";
    } else {
      bytes = await renderAnnualReportWord(data);
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

  await logAuditEvent({
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
  });

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
