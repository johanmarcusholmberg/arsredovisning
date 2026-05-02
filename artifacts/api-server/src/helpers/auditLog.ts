/**
 * Audit logging helper — server-side only.
 *
 * logAuditEvent inserts a row into audit_events via Drizzle.
 * The audit_events table is append-only — never update or delete rows.
 *
 * All event type constants are exported from this module so callers
 * use named constants rather than raw strings, reducing typo risk.
 *
 * NEVER import this module in frontend/browser code.
 */

import { db, auditEventsTable } from "@workspace/db";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Event type constants
// ---------------------------------------------------------------------------

export const AUDIT_EVENTS = {
  // Project lifecycle
  PROJECT_CREATED: "project.created",
  PROJECT_UPDATED: "project.updated",
  PROJECT_ARCHIVED: "project.archived",
  PROJECT_SNAPSHOT_CREATED: "snapshot.created",

  // File operations
  FILE_UPLOADED: "file.uploaded",
  FILE_DOWNLOAD_REQUESTED: "file.download_requested",

  // SIE / import
  SIE_UPLOADED: "sie.uploaded",
  SIE_PARSED: "sie.parsed",
  ACCOUNTS_MAPPED: "accounts.mapped",

  // Phase 3 import & mapping events
  IMPORT_FILE_UPLOADED: "import_file_uploaded",
  IMPORT_PARSE_STARTED: "import_parse_started",
  IMPORT_PARSE_COMPLETED: "import_parse_completed",
  IMPORT_PARSE_FAILED: "import_parse_failed",
  IMPORT_CONFIRMED: "import_confirmed",
  MAPPING_AUTO_APPLIED: "mapping_auto_applied",
  MAPPING_OVERRIDE_CREATED: "mapping_override_created",
  MAPPING_TEMPLATE_SAVED: "mapping_template_saved",

  // Financial statements
  STATEMENTS_GENERATED: "statements.generated",

  // Notes
  NOTE_CREATED: "note.created",
  NOTE_UPDATED: "note.updated",
  NOTE_DELETED: "note.deleted",

  // Validation
  VALIDATION_RUN: "validation.run",

  // Export
  EXPORT_GENERATED: "export.generated",
  EXPORT_DOWNLOADED: "export.downloaded",
  EXPORT_FAILED: "export.failed",
  EXPORT_PREVIEW_VIEWED: "export.preview_viewed",
  EXPORT_COVER_UPDATED: "export.cover_updated",
  EXPORT_READINESS_CHECKED: "export.readiness_checked",

  // Payment
  PAYMENT_INITIATED: "payment.initiated",
  PAYMENT_COMPLETED: "payment.completed",
  PAYMENT_FAILED: "payment.failed",

  // User management
  USER_INVITED: "user.invited",
  USER_REMOVED: "user.removed",
} as const;

export type AuditEventType = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS];

// ---------------------------------------------------------------------------
// Payload type
// ---------------------------------------------------------------------------

export interface LogAuditEventParams {
  eventType: AuditEventType | string;
  projectId?: string | null;
  companyId?: string | null;
  actorProfileId?: string | null;
  eventData?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/**
 * Insert an audit event row. Never throws — errors are logged and swallowed
 * to avoid audit failures cascading into the calling request.
 *
 * @example
 * await logAuditEvent({
 *   eventType: AUDIT_EVENTS.FILE_UPLOADED,
 *   projectId: project.id,
 *   actorProfileId: req.user.profileId,
 *   eventData: { filename: file.originalFilename, fileSize: file.fileSize },
 * });
 */
export async function logAuditEvent(params: LogAuditEventParams): Promise<void> {
  try {
    await db.insert(auditEventsTable).values({
      eventType: params.eventType,
      projectId: params.projectId ?? null,
      companyId: params.companyId ?? null,
      actorProfileId: params.actorProfileId ?? null,
      eventData: params.eventData ?? null,
    });
  } catch (err) {
    logger.error(
      { err, eventType: params.eventType, projectId: params.projectId },
      "Failed to write audit event — non-fatal",
    );
  }
}
