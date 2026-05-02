import {
  db,
  annualReportReclassificationAuditLogTable,
} from "@workspace/db";
import { logger } from "./logger.js";

/**
 * Dedicated audit log helper for reclassification & netting (Phase 6.5).
 *
 * Writes append-only rows to annual_report_reclassification_audit_log so the
 * reclassification UI can show a clean per-suggestion / per-reclassification
 * trail without filtering through the global audit_events stream.
 *
 * **Required, not fire-and-forget.** Each suggestion / reclassification
 * write operation MUST append an audit row — Phase 6.5 traceability
 * requires that every accepted, rejected, created, edited, or undone
 * action be recoverable from the trail. If the insert fails we propagate
 * the error so the calling route can either roll back its transaction
 * or return a 5xx to the client. Routes that batch this call inside a
 * `db.transaction(...)` block automatically get atomic behaviour: the
 * mutation and its audit row commit or roll back together.
 */
export type ReclassificationAuditEventType =
  | "suggestion_detected"
  | "suggestion_accepted"
  | "suggestion_rejected"
  | "suggestion_edited"
  | "suggestion_marked_not_relevant"
  | "reclassification_created"
  | "reclassification_undone"
  | "reclassification_validated";

export interface LogReclassAuditParams {
  reportId: string;
  eventType: ReclassificationAuditEventType;
  actorProfileId?: string | null;
  suggestionId?: string | null;
  reclassificationId?: string | null;
  payload?: Record<string, unknown> | null;
}

export async function logReclassificationAudit(
  params: LogReclassAuditParams,
): Promise<void> {
  try {
    await db.insert(annualReportReclassificationAuditLogTable).values({
      reportId: params.reportId,
      eventType: params.eventType,
      actorProfileId: params.actorProfileId ?? null,
      suggestionId: params.suggestionId ?? null,
      reclassificationId: params.reclassificationId ?? null,
      payloadJson: params.payload ?? null,
    });
  } catch (err) {
    // Log for observability and rethrow — the caller is responsible for
    // failing the request (and rolling back the surrounding transaction
    // if any) so traceability is never silently lost.
    logger.error(
      { err, eventType: params.eventType, reportId: params.reportId },
      "Failed to write reclassification audit entry",
    );
    throw err;
  }
}
