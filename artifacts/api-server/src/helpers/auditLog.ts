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
