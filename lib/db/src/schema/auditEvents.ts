import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { companiesTable } from "./companies";

/**
 * audit_events — immutable, append-only log of all significant actions.
 *
 * eventType constants (defined in helpers/auditLog.ts):
 *   "project.created", "project.updated", "project.archived"
 *   "sie.uploaded", "sie.parsed", "accounts.mapped"
 *   "statements.generated", "note.created", "note.updated", "note.deleted"
 *   "validation.run", "snapshot.created"
 *   "export.generated", "export.downloaded"
 *   "payment.initiated", "payment.completed", "payment.failed"
 *   "file.uploaded", "file.download_requested"
 *   "user.invited", "user.removed"
 *
 * projectId / companyId / actorProfileId: nullable with ON DELETE SET NULL —
 *   event rows survive even if the referenced entity is later deleted.
 *   This preserves the historical audit trail.
 *
 * IMPORTANT: Never UPDATE or DELETE rows from this table.
 * RLS: users can read events for projects they have access to. Inserts via service role only.
 */
export const auditEventsTable = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: text("event_type").notNull(),
  projectId: uuid("project_id"),
  companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "set null" }),
  actorProfileId: uuid("actor_profile_id").references(() => profilesTable.id, { onDelete: "set null" }),
  eventData: jsonb("event_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditEventSchema = createInsertSchema(auditEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type AuditEvent = typeof auditEventsTable.$inferSelect;
