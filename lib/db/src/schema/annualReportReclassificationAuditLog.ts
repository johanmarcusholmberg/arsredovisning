import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reportsTable } from "./reports";
import { profilesTable } from "./profiles";

/**
 * annual_report_reclassification_audit_log —
 * append-only audit trail for every reclassification-related action:
 *   suggestion_detected, suggestion_accepted, suggestion_rejected,
 *   suggestion_edited, suggestion_marked_not_relevant,
 *   reclassification_created, reclassification_undone,
 *   reclassification_validated.
 *
 * Independent of the generic audit_events table so the reclassification
 * UI can show a clean per-suggestion / per-reclassification trail without
 * filtering through unrelated event types.
 *
 * RLS: project members can read; service role inserts only. Never UPDATE or
 * DELETE rows from this table.
 */
export const annualReportReclassificationAuditLogTable = pgTable(
  "annual_report_reclassification_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reportsTable.id, { onDelete: "cascade" }),
    suggestionId: uuid("suggestion_id"),
    reclassificationId: uuid("reclassification_id"),
    eventType: text("event_type").notNull(),
    actorProfileId: uuid("actor_profile_id").references(
      () => profilesTable.id,
      { onDelete: "set null" },
    ),
    payloadJson: jsonb("payload_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    reportIdIdx: index("ar_recl_audit_report_id_idx").on(table.reportId),
    suggestionIdx: index("ar_recl_audit_suggestion_idx").on(table.suggestionId),
    reclassificationIdx: index("ar_recl_audit_reclassification_idx").on(
      table.reclassificationId,
    ),
  }),
);

export const insertAnnualReportReclassificationAuditEntrySchema =
  createInsertSchema(annualReportReclassificationAuditLogTable).omit({
    id: true,
    createdAt: true,
  });

export type InsertAnnualReportReclassificationAuditEntry = z.infer<
  typeof insertAnnualReportReclassificationAuditEntrySchema
>;
export type AnnualReportReclassificationAuditEntry =
  typeof annualReportReclassificationAuditLogTable.$inferSelect;
