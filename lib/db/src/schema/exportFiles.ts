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
import { exportFormatEnum, exportStatusEnum } from "./enums";
import { annualReportProjectsTable } from "./annualReportProjects";
import { profilesTable } from "./profiles";

/**
 * export_files — metadata for generated export files (PDF, Word).
 * The actual file lives in Supabase Storage under the "exports" bucket.
 *
 * watermark: true for demo exports or unpaid exports — the PDF/Word file
 *   will contain a visible "DEMO" watermark. Never deliver unwatermarked
 *   exports unless hasPaidProjectEntitlement is true.
 * storagePath: full path within the "exports" bucket.
 * generatedByProfileId: null for system-triggered exports.
 *
 * RLS: readable by profiles with project access.
 *   Written only by the export service via service role key.
 *   Delete requires owner role.
 */
export const exportFilesTable = pgTable("export_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => annualReportProjectsTable.id, { onDelete: "cascade" }),
  generatedByProfileId: uuid("generated_by_profile_id").references(() => profilesTable.id),
  storageBucket: text("storage_bucket").notNull().default("exports"),
  storagePath: text("storage_path").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size"),
  format: exportFormatEnum("format").notNull(),
  exportStatus: exportStatusEnum("export_status").notNull().default("pending"),
  watermark: boolean("watermark").notNull().default(true),
  // ── Phase 7: snapshot summary captured at generation time ───────────────
  // Mirrors export-contract `ExportSnapshotSummary` (counts, fiscal-year
  // label, watermark, framework). Lets the history view describe the
  // contents of an old export without re-loading the underlying tables.
  snapshotSummary: jsonb("snapshot_summary"),
  // Optional grouping when several files belong to the same export package
  // (PDF + Word + appendices generated together).
  packageId: uuid("package_id"),
  // Human-readable label (e.g. "Slutgiltig årsredovisning – PDF").
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExportFileSchema = createInsertSchema(exportFilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExportFile = z.infer<typeof insertExportFileSchema>;
export type ExportFile = typeof exportFilesTable.$inferSelect;
