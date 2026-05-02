import { pgTable, text, timestamp, uuid, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

/**
 * annual_report_projects — one row per company per fiscal year.
 * status lifecycle: "draft" → "in_review" → "approved" → "exported".
 * noteNumberingScheme: how notes are numbered (e.g. "sequential" for K3).
 * Future: sectionStatus JSON stores per-section completion (import, mapping, statements, notes, validation, export).
 * Future RLS: access controlled via project_access table.
 */
export const annualReportProjectsTable = pgTable("annual_report_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companiesTable.id),
  fiscalYearStart: date("fiscal_year_start").notNull(),
  fiscalYearEnd: date("fiscal_year_end").notNull(),
  accountingFramework: text("accounting_framework").notNull().default("K3"),
  status: text("status").notNull().default("draft"),
  noteNumberingScheme: text("note_numbering_scheme").notNull().default("sequential"),
  sectionStatusJson: text("section_status_json").default("{}"),
  importedSieFileName: text("imported_sie_file_name"),
  exportedPdfUrl: text("exported_pdf_url"),
  exportedWordUrl: text("exported_word_url"),
  createdByProfileId: uuid("created_by_profile_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAnnualReportProjectSchema = createInsertSchema(
  annualReportProjectsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAnnualReportProject = z.infer<typeof insertAnnualReportProjectSchema>;
export type AnnualReportProject = typeof annualReportProjectsTable.$inferSelect;
