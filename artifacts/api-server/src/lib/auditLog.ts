import { db, auditEventsTable } from "@workspace/db";
import { logger } from "./logger.js";

interface AuditEvent {
  eventType: string;
  actorProfileId?: string;
  companyId?: string;
  projectId?: string;
  payload?: Record<string, unknown>;
}

/**
 * logAuditEvent — inserts an immutable audit event row.
 * Fire-and-forget: errors are logged but not thrown so they don't break the main request.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await db.insert(auditEventsTable).values({
      eventType: event.eventType,
      actorProfileId: event.actorProfileId ?? null,
      companyId: event.companyId ?? null,
      projectId: event.projectId ?? null,
      payload: event.payload ?? null,
    });
  } catch (err) {
    logger.error({ err, event }, "Failed to write audit event");
  }
}
