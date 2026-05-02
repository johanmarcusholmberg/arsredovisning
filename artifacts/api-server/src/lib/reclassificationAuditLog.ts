import {
  db,
  annualReportReclassificationAuditLogTable,
} from "@workspace/db";
import { logger } from "./logger.js";

/**
 * Minimal executor interface satisfied by both `db` and the transaction
 * argument supplied by `db.transaction(async (tx) => …)`. We keep this
 * structural so callers don't have to thread Drizzle's PgTransaction
 * generic types through every helper signature.
 */
type AuditExecutor = Pick<typeof db, "insert">;

/**
 * Dedicated audit log helper for reclassification & netting (Phase 6.5).
 *
 * Writes append-only rows to annual_report_reclassification_audit_log so the
 * reclassification UI can show a clean per-suggestion / per-reclassification
 * trail without filtering through the global audit_events stream.
 *
 * **Required and atomic.** Phase 6.5 traceability requires that every
 * accepted, rejected, edited, created, or undone action be recoverable
 * from the trail. To make the contract enforceable, callers MUST pass
 * the surrounding transaction handle via `executor` whenever the audit
 * row belongs to a domain mutation (suggestion update, reclass insert,
 * reclass undo). The mutation and the audit insert then commit or roll
 * back together: a successful response always implies a written audit
 * row, and a failed audit insert poisons the whole transaction.
 *
 * For ambient audit events that are not tied to a domain mutation
 * (e.g. `suggestion_detected` after a long-running scan), `executor`
 * may be omitted and the helper writes against the top-level `db`.
 * Either way the helper rethrows on failure — never fire-and-forget.
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
  /**
   * Optional transaction handle. When the audit row belongs to a
   * domain mutation, pass the `tx` argument from
   * `db.transaction(async (tx) => …)` so both the mutation and the
   * audit insert commit or roll back together.
   */
  executor?: AuditExecutor;
}

export async function logReclassificationAudit(
  params: LogReclassAuditParams,
): Promise<void> {
  const exec = params.executor ?? db;
  try {
    await exec.insert(annualReportReclassificationAuditLogTable).values({
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
