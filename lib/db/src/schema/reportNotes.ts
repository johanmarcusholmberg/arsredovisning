import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reportsTable } from "./reports";

/**
 * report_notes — placeholder table for the notes module (Phase 5).
 * noteType: machine key matching the framework rule trigger (e.g. "revenue", "personnel").
 * status: "placeholder" | "draft" | "complete"
 */
export const reportNotesTable = pgTable("report_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reportsTable.id, { onDelete: "cascade" }),
  noteNumber: integer("note_number"),
  noteType: text("note_type"),
  title: text("title"),
  status: text("status").notNull().default("placeholder"),
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
