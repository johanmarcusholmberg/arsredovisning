import { pgTable, text, timestamp, uuid, date, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";
import { profilesTable } from "./profiles";
import { accountingFrameworkEnum, projectStatusEnum, annualReportLanguageEnum } from "./enums";

/**
 * annual_report_projects — one row per company per fiscal year.
 * status lifecycle: "draft" → "in_review" → "approved" → "exported" → "archived".
 * accountingFramework: "K2" or "K3" (inherited from company but can be overridden).
 * annualReportLanguage: "sv" (Swedish) or "en" (English) — the language of the output document.
 * isDemo: true means this project is a sandboxed demo and never writes to production storage.
 *   Demo projects always produce watermarked exports. Identified by DEMO_PROJECT_ID constant
 *   OR by this flag for future user-created demo sandboxes.
 * sectionStatusJson: JSONB tracking per-section completion:
 *   { import, mapping, statements, notes, validation, export } each with a status string.
 * RLS: access controlled via project_access table — users only see projects they are on.
 *   Service role bypasses for system operations and audit writes.
 */
export const annualReportProjectsTable = pgTable("annual_report_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companiesTable.id),
  createdByProfileId: uuid("created_by_profile_id").references(() => profilesTable.id),
  fiscalYearStart: date("fiscal_year_start").notNull(),
  fiscalYearEnd: date("fiscal_year_end").notNull(),
  accountingFramework: accountingFrameworkEnum("accounting_framework").notNull().default("K3"),
  annualReportLanguage: annualReportLanguageEnum("annual_report_language").notNull().default("sv"),
  status: projectStatusEnum("status").notNull().default("draft"),
  isDemo: boolean("is_demo").notNull().default(false),
  noteNumberingScheme: text("note_numbering_scheme").notNull().default("sequential"),
  sectionStatusJson: jsonb("section_status_json").default({}),
  importedSieFileName: text("imported_sie_file_name"),
  exportedPdfUrl: text("exported_pdf_url"),
  exportedWordUrl: text("exported_word_url"),
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
