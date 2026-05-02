import {
  pgTable,
  text,
  timestamp,
  uuid,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reportsTable } from "./reports";
import { reportNoteRowsTable } from "./reportNoteRows";
import { profilesTable } from "./profiles";
import {
  reclassificationStatusEnum,
  reclassificationEffectTypeEnum,
} from "./enums";
import { annualReportReclassificationSuggestionsTable } from "./annualReportReclassificationSuggestions";

/**
 * annual_report_reclassifications —
 * approved (or manually entered) reclassifications. The presentation
 * calculation engine computes:
 *   finalAmount = mappedAmount + sum(active.amount where target = X)
 *                              - sum(active.amount where source = X)
 *
 * Imported accounting data is NEVER mutated. Undoing a reclassification
 * flips status to "undone" and writes an audit row — the row is preserved
 * for traceability.
 *
 * sourceSuggestionId is set when the reclassification originated from an
 * accepted suggestion; null when manually created.
 */
export const annualReportReclassificationsTable = pgTable(
  "annual_report_reclassifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reportsTable.id, { onDelete: "cascade" }),
    sourceSuggestionId: uuid("source_suggestion_id").references(
      () => annualReportReclassificationSuggestionsTable.id,
      { onDelete: "set null" },
    ),
    sourceNoteRowId: uuid("source_note_row_id").references(
      () => reportNoteRowsTable.id,
      { onDelete: "set null" },
    ),
    targetNoteRowId: uuid("target_note_row_id")
      .notNull()
      .references(() => reportNoteRowsTable.id, { onDelete: "cascade" }),
    sourceLabel: text("source_label"),
    targetLabel: text("target_label"),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    effectType: reclassificationEffectTypeEnum("effect_type")
      .notNull()
      .default("note_only"),
    reason: text("reason"),
    status: reclassificationStatusEnum("status").notNull().default("active"),
    createdByProfileId: uuid("created_by_profile_id").references(
      () => profilesTable.id,
      { onDelete: "set null" },
    ),
    undoneAt: timestamp("undone_at", { withTimezone: true }),
    undoneByProfileId: uuid("undone_by_profile_id").references(
      () => profilesTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    reportIdIdx: index("ar_recl_report_id_idx").on(table.reportId),
    sourceRowIdx: index("ar_recl_source_row_idx").on(table.sourceNoteRowId),
    targetRowIdx: index("ar_recl_target_row_idx").on(table.targetNoteRowId),
    statusIdx: index("ar_recl_status_idx").on(table.status),
  }),
);

export const insertAnnualReportReclassificationSchema = createInsertSchema(
  annualReportReclassificationsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAnnualReportReclassification = z.infer<
  typeof insertAnnualReportReclassificationSchema
>;
export type AnnualReportReclassification =
  typeof annualReportReclassificationsTable.$inferSelect;
