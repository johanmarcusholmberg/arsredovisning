import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  numeric,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reportsTable } from "./reports";
import {
  accountingFrameworkEnum,
  noteRequirementLevelEnum,
  noteStatusEnum,
} from "./enums";

/**
 * report_notes — full notes module for the annual report.
 * One row per note (e.g. Redovisningsprinciper, Personalkostnader).
 *
 * noteNumber is assigned by the noteNumberingService and renumbered whenever
 * notes are added, removed, reordered or marked not_applicable.
 *
 * suggestedText is the AI/template draft. acceptedText is the user-confirmed
 * text. Only acceptedText is rendered in the final report.
 */
export const reportNotesTable = pgTable("report_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reportsTable.id, { onDelete: "cascade" }),
  noteNumber: integer("note_number"),
  noteType: text("note_type").notNull(),
  title: text("title").notNull(),
  requirementLevel: noteRequirementLevelEnum("requirement_level")
    .notNull()
    .default("optional"),
  status: noteStatusEnum("status").notNull().default("not_started"),
  framework: accountingFrameworkEnum("framework").notNull().default("K3"),
  sourceTrigger: text("source_trigger"),
  linkedStatementLines: jsonb("linked_statement_lines"),
  linkedAccountGroups: jsonb("linked_account_groups"),
  currentYearValue: numeric("current_year_value", { precision: 18, scale: 2 }),
  previousYearValue: numeric("previous_year_value", { precision: 18, scale: 2 }),
  suggestedText: text("suggested_text"),
  acceptedText: text("accepted_text"),
  acceptedByProfileId: uuid("accepted_by_profile_id"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  textIsAiGenerated: boolean("text_is_ai_generated").notNull().default(false),
  manualNumberOverride: integer("manual_number_override"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReportNoteSchema = createInsertSchema(reportNotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReportNote = z.infer<typeof insertReportNoteSchema>;
export type ReportNote = typeof reportNotesTable.$inferSelect;
