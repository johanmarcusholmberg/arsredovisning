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
 * Fire-and-forget: errors are logged but not thrown so they don't break the
 * main request flow.
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
    logger.error(
      { err, eventType: params.eventType, reportId: params.reportId },
      "Failed to write reclassification audit entry — non-fatal",
    );
  }
}
