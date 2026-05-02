import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reportsTable } from "./reports";
import { noteReferenceStatusEnum, statementTypeEnum } from "./enums";
import { financialStatementLinesTable } from "./financialStatementLines";

/**
 * report_note_references — links a statement line to a note (existing or suggested).
 * One row per (statement_line, note_type) pair.
 */
export const reportNoteReferencesTable = pgTable("report_note_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reportsTable.id, { onDelete: "cascade" }),
  statementType: statementTypeEnum("statement_type").notNull(),
  financialStatementLineId: uuid("financial_statement_line_id")
    .notNull()
    .references(() => financialStatementLinesTable.id, { onDelete: "cascade" }),
  noteId: uuid("note_id"),
  suggestedNoteType: text("suggested_note_type"),
  referenceStatus: noteReferenceStatusEnum("reference_status").notNull().default("suggested"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReportNoteReferenceSchema = createInsertSchema(
  reportNoteReferencesTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertReportNoteReference = z.infer<typeof insertReportNoteReferenceSchema>;
export type ReportNoteReference = typeof reportNoteReferencesTable.$inferSelect;
