/**
 * File upload and download routes — Phase 2.5.
 *
 * Security skeleton for file operations:
 * 1. Auth/session check (requireAuth middleware applied in routes/index.ts)
 * 2. Permission check via helpers/permissions.ts
 * 3. Entitlement check via hasPaidProjectEntitlement
 * 4. File type and size validation against an allowed-types allowlist
 * 5. project_files / export_files metadata insert
 * 6. Storage path resolution (demo → demo-assets; real → production bucket)
 * 7. Signed URL stub (TODO: replace with real Supabase Storage signed URL)
 *
 * Actual file parsing is NOT done here — that is Phase 3.
 * Actual export generation is NOT done here — that is Phase 7.
 *
 * SECURITY: All routes require authentication. Do not remove requireAuth
 * from the parent router or add unauthenticated bypass logic here.
 */

import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, projectFilesTable, exportFilesTable } from "@workspace/db";
import { canViewProject, canUploadFiles, hasPaidProjectEntitlement } from "../helpers/permissions";
import { logAuditEvent, AUDIT_EVENTS } from "../helpers/auditLog";
import {
  isDemoProject,
  resolveUploadBucket,
  buildStoragePath,
  mustWatermark,
} from "../helpers/demo";
import { getSupabaseAdmin } from "../lib/supabase";
import { readCachedExportBytes } from "./annualReportExport";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Allowed file types for upload
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/octet-stream": "sie",
  "text/plain": "sie",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
  "application/vnd.ms-excel": "excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
  "image/jpeg": "image",
  "image/png": "image",
};

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

// ---------------------------------------------------------------------------
// POST /api/projects/:projectId/files/upload
// ---------------------------------------------------------------------------

/**
 * Upload a file to a project.
 *
 * Expected request body (JSON):
 * {
 *   originalFilename: string,
 *   mimeType: string,
 *   fileSize?: number,       // bytes
 *   fileType?: string,       // "sie" | "pdf" | "excel" | "image" (inferred from mimeType if absent)
 *   storageBucket?: string,  // optional override, defaults to "import-files"
 * }
 *
 * Returns:
 * {
 *   fileId: string,
 *   storageBucket: string,
 *   storagePath: string,
 *   uploadUrl: string,       // signed upload URL stub (TODO: real Supabase Storage URL)
 *   isDemo: boolean,
 * }
 */
router.post("/projects/:projectId/files/upload", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const profileId: string | undefined = req.user?.profileId;

  if (!profileId) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }

  // 1. Permission check — must be accountant or owner
  if (!(await canUploadFiles(profileId, projectId))) {
    req.log.warn({ profileId, projectId }, "Upload rejected — insufficient project role");
    res.status(403).json({
      error: "forbidden",
      message: "You do not have permission to upload files to this project",
    });
    return;
  }

  // 2. Demo detection (single source of truth for all downstream decisions)
  const isDemo = await isDemoProject(projectId);

  // 3. Entitlement check — real projects require a paid entitlement
  if (!isDemo) {
    const isPaid = await hasPaidProjectEntitlement(projectId);
    if (!isPaid) {
      req.log.warn({ profileId, projectId }, "Upload rejected — no paid entitlement");
      res.status(402).json({
        error: "payment_required",
        message: "A paid entitlement is required to upload files to this project",
      });
      return;
    }
  }

  // 4. Input validation
  const {
    originalFilename,
    mimeType,
    fileSize,
    fileType: explicitFileType,
    storageBucket: requestedBucket,
  } = req.body as {
    originalFilename?: string;
    mimeType?: string;
    fileSize?: number;
    fileType?: string;
    storageBucket?: string;
  };

  if (!originalFilename || !mimeType) {
    res.status(400).json({
      error: "invalid_input",
      message: "originalFilename and mimeType are required",
    });
    return;
  }

  const detectedFileType = ALLOWED_MIME_TYPES[mimeType];
  if (!detectedFileType) {
    res.status(400).json({
      error: "invalid_file_type",
      message: `File type not allowed: ${mimeType}`,
      allowedMimeTypes: Object.keys(ALLOWED_MIME_TYPES),
    });
    return;
  }

  if (fileSize !== undefined && fileSize > MAX_FILE_SIZE_BYTES) {
    res.status(400).json({
      error: "file_too_large",
      message: `File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`,
    });
    return;
  }

  // 5. Resolve storage bucket — demo projects always land in demo-assets
  const fileId = randomUUID();
  const bucket = resolveUploadBucket(isDemo, requestedBucket ?? "import-files");
  const storagePath = buildStoragePath(projectId, fileId, originalFilename);

  // 6. Insert metadata row with upload_status: "pending"
  const [fileRow] = await db
    .insert(projectFilesTable)
    .values({
      id: fileId,
      projectId,
      uploadedByProfileId: profileId,
      storageBucket: bucket,
      storagePath,
      originalFilename,
      mimeType,
      fileSize: fileSize ?? null,
      fileType: explicitFileType ?? detectedFileType,
      uploadStatus: "pending",
      isDemo,
    })
    .returning();

  // 7. Log audit event
  await logAuditEvent({
    eventType: AUDIT_EVENTS.FILE_UPLOADED,
    projectId,
    actorProfileId: profileId,
    eventData: { fileId, originalFilename, mimeType, fileSize, storageBucket: bucket, storagePath, isDemo },
  });

  // 8. Return storage path and a signed upload URL stub
  // TODO (Phase 3+): Replace with a real Supabase Storage signed upload URL:
  //   const { data, error } = await supabaseAdmin.storage
  //     .from(bucket).createSignedUploadUrl(storagePath);
  res.status(201).json({
    fileId: fileRow.id,
    storageBucket: bucket,
    storagePath,
    uploadUrl: `TODO:supabase-signed-upload-url/${bucket}/${storagePath}`,
    isDemo,
  });
});

// ---------------------------------------------------------------------------
// GET /api/projects/:projectId/files/:fileId/download
// ---------------------------------------------------------------------------

/**
 * Get a signed download URL for a project file.
 *
 * Returns: { downloadUrl, filename, mimeType }
 */
router.get(
  "/projects/:projectId/files/:fileId/download",
  async (req, res): Promise<void> => {
    const { projectId, fileId } = req.params;
    const profileId: string | undefined = req.user?.profileId;

    if (!profileId) {
      res.status(401).json({ error: "unauthorized", message: "Authentication required" });
      return;
    }

    if (!(await canViewProject(profileId, projectId))) {
      res.status(403).json({ error: "forbidden", message: "You do not have permission to access this project" });
      return;
    }

    const [file] = await db
      .select()
      .from(projectFilesTable)
      .where(and(eq(projectFilesTable.id, fileId), eq(projectFilesTable.projectId, projectId)))
      .limit(1);

    if (!file) {
      res.status(404).json({ error: "not_found", message: "File not found" });
      return;
    }

    await logAuditEvent({
      eventType: AUDIT_EVENTS.FILE_DOWNLOAD_REQUESTED,
      projectId,
      actorProfileId: profileId,
      eventData: { fileId, filename: file.originalFilename },
    });

    // TODO (Phase 3+): Real Supabase Storage signed URL:
    //   const { data } = await supabaseAdmin.storage.from(file.storageBucket).createSignedUrl(file.storagePath, 3600);
    res.json({
      downloadUrl: `TODO:supabase-signed-url/${file.storageBucket}/${file.storagePath}`,
      filename: file.originalFilename,
      mimeType: file.mimeType,
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/projects/:projectId/exports/:exportId/download
// ---------------------------------------------------------------------------

/**
 * Get a signed download URL for a generated export file.
 * Watermark flag is re-computed server-side on every request — never trusted from client.
 *
 * Returns: { downloadUrl, filename, mimeType, watermark }
 */
router.get(
  "/projects/:projectId/exports/:exportId/download",
  async (req, res): Promise<void> => {
    const { projectId, exportId } = req.params;
    const profileId: string | undefined = req.user?.profileId;

    if (!profileId) {
      res.status(401).json({ error: "unauthorized", message: "Authentication required" });
      return;
    }

    if (!(await canViewProject(profileId, projectId))) {
      res.status(403).json({ error: "forbidden", message: "You do not have permission to access this project" });
      return;
    }

    const [exportFile] = await db
      .select()
      .from(exportFilesTable)
      .where(and(eq(exportFilesTable.id, exportId), eq(exportFilesTable.projectId, projectId)))
      .limit(1);

    if (!exportFile) {
      res.status(404).json({ error: "not_found", message: "Export not found" });
      return;
    }

    // Enforce watermark server-side — demo AND unpaid → always watermarked
    const isDemo = await isDemoProject(projectId);
    const isPaid = await hasPaidProjectEntitlement(projectId);
    const watermark = mustWatermark(isDemo, isPaid);

    await logAuditEvent({
      eventType: AUDIT_EVENTS.EXPORT_DOWNLOADED,
      projectId,
      actorProfileId: profileId,
      eventData: { exportId, format: exportFile.format, watermark, filename: exportFile.originalFilename },
    });

    // Real Supabase signed URL — short-lived (1h). When Supabase is not
    // configured (dev/preview) we fall back to streaming the bytes directly
    // from the in-memory export cache populated at generation time.
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data, error } = await supabase.storage
          .from(exportFile.storageBucket)
          .createSignedUrl(exportFile.storagePath, 3600);
        if (!error && data?.signedUrl) {
          res.json({
            downloadUrl: data.signedUrl,
            filename: exportFile.originalFilename,
            mimeType: exportFile.mimeType,
            watermark,
          });
          return;
        }
        req.log.warn(
          { err: error?.message, storagePath: exportFile.storagePath },
          "Supabase signed URL failed — falling back to inline stream",
        );
      } catch (err) {
        req.log.warn({ err }, "Supabase signed URL threw — falling back to inline stream");
      }
    }

    const cached = readCachedExportBytes(exportId);
    if (cached) {
      res.setHeader("Content-Type", cached.mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportFile.originalFilename}"`,
      );
      res.send(cached.bytes);
      return;
    }

    // No Supabase, no cached bytes — likely an old export. Surface a
    // diagnosable error rather than a silent fallback.
    res.status(410).json({
      error: "export_unavailable",
      message:
        "Den genererade filen kan inte hämtas — försök generera exporten på nytt.",
    });
  },
);

export default router;
