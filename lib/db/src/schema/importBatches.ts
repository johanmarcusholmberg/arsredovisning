import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { importFileTypeEnum, batchStatusEnum } from "./enums";
import { annualReportProjectsTable } from "./annualReportProjects";
import { profilesTable } from "./profiles";

/**
 * import_batches — one row per import attempt for a project.
 *
 * An import starts as "pending" → "parsing" → "parsed" | "partial" | "failed"
 * → "confirmed" | "cancelled".
 *
 * Only "confirmed" batches are treated as project data.
 * Unconfirmed or cancelled batches are never used for report generation.
 *
 * parsingErrors: JSONB array of { section, message, severity } objects.
 *   Unsupported SIE sections, malformed rows, and format errors land here.
 *   Never silently ignored.
 *
 * fiscalYearDetected: fiscal year extracted from SIE header (#RAR / #FNAMN) or
 *   detected from transaction dates in CSV/Excel.
 *
 * summaryJson: JSONB snapshot produced after parsing:
 *   { accountsFound, balancesFound, transactionsFound, missingNameAccounts, warnings }
 *
 * RLS: readable/writable by project owner and accountant. Service role for system ops.
 */
export const importBatchesTable = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => annualReportProjectsTable.id, { onDelete: "cascade" }),
  uploadedByProfileId: uuid("uploaded_by_profile_id").references(() => profilesTable.id, {
    onDelete: "set null",
  }),
  originalFilename: text("original_filename").notNull(),
  fileType: importFileTypeEnum("file_type").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  storageBucket: text("storage_bucket"),
  storagePath: text("storage_path"),
  status: batchStatusEnum("status").notNull().default("pending"),
  fiscalYearDetected: text("fiscal_year_detected"),
  accountsFound: integer("accounts_found").default(0),
  balancesFound: integer("balances_found").default(0),
  transactionsFound: integer("transactions_found").default(0),
  parsingErrors: jsonb("parsing_errors").$type<Array<{ section: string; message: string; severity: "warning" | "error" }>>().default([]),
  summaryJson: jsonb("summary_json"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  confirmedByProfileId: uuid("confirmed_by_profile_id").references(() => profilesTable.id, {
    onDelete: "set null",
  }),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertImportBatchSchema = createInsertSchema(importBatchesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertImportBatch = z.infer<typeof insertImportBatchSchema>;
export type ImportBatch = typeof importBatchesTable.$inferSelect;
