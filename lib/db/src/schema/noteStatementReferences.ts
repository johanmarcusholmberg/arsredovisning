import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reportNotesTable } from "./reportNotes";
import { statementTypeEnum } from "./enums";

/**
 * note_statement_references — links a note to one or more financial statement lines.
 * One row per (note, lineKey) pair.
 *
 * displayLabel is the rendered badge text for the statement reference column
 * (e.g. "Not 1", "Not 12"). It is updated by noteNumberingService whenever
 * note numbers change so financial-statement reference columns stay in sync.
 */
export const noteStatementReferencesTable = pgTable("note_statement_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  noteId: uuid("note_id")
    .notNull()
    .references(() => reportNotesTable.id, { onDelete: "cascade" }),
  statementType: statementTypeEnum("statement_type").notNull(),
  lineKey: text("line_key").notNull(),
  displayLabel: text("display_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNoteStatementReferenceSchema = createInsertSchema(
  noteStatementReferencesTable,
).omit({ id: true, createdAt: true });

export type InsertNoteStatementReference = z.infer<
  typeof insertNoteStatementReferenceSchema
>;
export type NoteStatementReference =
  typeof noteStatementReferencesTable.$inferSelect;
