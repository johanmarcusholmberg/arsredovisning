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
import { uploadStatusEnum, parseStatusEnum } from "./enums";
import { annualReportProjectsTable } from "./annualReportProjects";
import { profilesTable } from "./profiles";

/**
 * project_files — metadata for files uploaded to a project.
 * Covers SIE import files, previous annual reports (PDF), cover sheets, etc.
 * The actual file content lives in Supabase Storage; this table stores metadata only.
 *
 * storageBucket: one of the five defined buckets (import-files, previous-annual-reports,
 *   cover-sheets, exports, demo-assets).
 * storagePath: full path within the bucket, e.g. "{projectId}/{uuid}/{filename}".
 * uploadStatus: pending → uploaded → (failed | deleted).
 * parseStatus: null until parsing is triggered, then pending → processing → completed | failed.
 * noteNumberingState: reserved JSONB for Phase 5 (note auto-numbering state machine).
 *
 * RLS: readable and writable by profiles with project access (owner or accountant role).
 *   Delete requires owner role. Service role bypasses RLS for system operations.
 */
export const projectFilesTable = pgTable("project_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => annualReportProjectsTable.id, { onDelete: "cascade" }),
  uploadedByProfileId: uuid("uploaded_by_profile_id").references(() => profilesTable.id),
  storageBucket: text("storage_bucket").notNull(),
  storagePath: text("storage_path").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size"),
  fileType: text("file_type").notNull(),
  uploadStatus: uploadStatusEnum("upload_status").notNull().default("pending"),
  parseStatus: parseStatusEnum("parse_status"),
  noteNumberingState: jsonb("note_numbering_state"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProjectFileSchema = createInsertSchema(projectFilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProjectFile = z.infer<typeof insertProjectFileSchema>;
export type ProjectFile = typeof projectFilesTable.$inferSelect;
