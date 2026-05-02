import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * audit_events — immutable log of all significant actions in the system.
 * eventType examples: "project.created", "sie.imported", "statements.generated",
 *   "note.updated", "validation.run", "export.generated", "payment.completed".
 * actorProfileId: null for system-generated events.
 * payload: arbitrary JSON with event-specific details (before/after values, file names, etc.).
 * Future: This table is append-only. Never update or delete rows. RLS: users can
 *   read events for projects they have access to. System events use a service role key.
 */
export const auditEventsTable = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: text("event_type").notNull(),
  projectId: uuid("project_id"),
  companyId: uuid("company_id"),
  actorProfileId: uuid("actor_profile_id"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditEventSchema = createInsertSchema(auditEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type AuditEvent = typeof auditEventsTable.$inferSelect;
