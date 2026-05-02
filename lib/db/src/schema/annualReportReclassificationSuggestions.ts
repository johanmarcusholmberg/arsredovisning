import {
  pgTable,
  text,
  timestamp,
  uuid,
  numeric,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reportsTable } from "./reports";
import { reportNoteRowsTable } from "./reportNoteRows";
import { profilesTable } from "./profiles";
import {
  reclassificationSuggestionStatusEnum,
  reclassificationConfidenceEnum,
  reclassificationEffectTypeEnum,
} from "./enums";

/**
 * annual_report_reclassification_suggestions —
 * rule-engine-generated candidates for reclassifying / netting amounts
 * between note rows. Each suggestion is reviewed by the user; nothing in
 * this table affects presented amounts until accepted.
 *
 * The engine produces these from rules like opposite signs on the same
 * counterparty, matching BAS account ranges, similar VAT/tax categories,
 * intercompany pairs, and similar absolute amounts.
 *
 * Source / target are EITHER a note row id OR a free-form sourceLabel
 * (e.g. "Konto 1510 – Kundfordringar"). At least one of the source columns
 * must be filled. Targets reference an existing note row to be moved into.
 *
 * RLS: project members can read; only owners and accountants can update
 * status. The audit log table is the source of truth for every transition.
 */
export const annualReportReclassificationSuggestionsTable = pgTable(
  "annual_report_reclassification_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reportsTable.id, { onDelete: "cascade" }),
    sourceNoteRowId: uuid("source_note_row_id").references(
      () => reportNoteRowsTable.id,
      { onDelete: "set null" },
    ),
    targetNoteRowId: uuid("target_note_row_id").references(
      () => reportNoteRowsTable.id,
      { onDelete: "set null" },
    ),
    sourceLabel: text("source_label"),
    targetLabel: text("target_label"),
    sourceAccountNumber: text("source_account_number"),
    targetAccountNumber: text("target_account_number"),
    suggestedAmount: numeric("suggested_amount", {
      precision: 18,
      scale: 2,
    }).notNull(),
    confidenceLevel:
      reclassificationConfidenceEnum("confidence_level").notNull(),
    ruleKey: text("rule_key").notNull(),
    explanation: text("explanation").notNull(),
    detailJson: jsonb("detail_json"),
    effectType: reclassificationEffectTypeEnum("effect_type")
      .notNull()
      .default("note_only"),
    status: reclassificationSuggestionStatusEnum("status")
      .notNull()
      .default("suggested"),
    reviewedByProfileId: uuid("reviewed_by_profile_id").references(
      () => profilesTable.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewerComment: text("reviewer_comment"),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    reportIdIdx: index("ar_recl_suggestions_report_id_idx").on(table.reportId),
    statusIdx: index("ar_recl_suggestions_status_idx").on(table.status),
  }),
);

export const insertAnnualReportReclassificationSuggestionSchema =
  createInsertSchema(
    annualReportReclassificationSuggestionsTable,
  ).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export type InsertAnnualReportReclassificationSuggestion = z.infer<
  typeof insertAnnualReportReclassificationSuggestionSchema
>;
export type AnnualReportReclassificationSuggestion =
  typeof annualReportReclassificationSuggestionsTable.$inferSelect;
