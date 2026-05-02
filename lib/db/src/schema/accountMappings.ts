import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { mappingConfidenceEnum, mappingStatusEnum } from "./enums";
import { annualReportProjectsTable } from "./annualReportProjects";
import { importBatchesTable } from "./importBatches";
import { profilesTable } from "./profiles";

/**
 * account_mappings — one row per imported account per confirmed batch.
 *
 * Created by the auto-mapping engine after a batch is confirmed.
 * Can be overridden manually; manual overrides are tracked in mapping_overrides.
 *
 * reportLine: the K2/K3 balance sheet or income statement line
 *   (e.g. "BS_1110_Goodwill", "IS_3000_NetRevenue").
 * basRange: the BAS range used for the auto-mapping rule
 *   (e.g. "1000-1099", "3000-3999").
 * confidence: "high" | "medium" | "low" | "unmapped".
 * status: "auto_mapped" | "suggested" | "needs_review" | "manually_mapped" | "unmapped".
 * noteImpactFlag: true if this account's mapping implies a mandatory note
 *   (e.g. fixed assets → fixed asset note, loans → financing note).
 * noteImpactMetadata: JSONB with specifics: { noteType, noteKey }.
 * isManualOverride: true if this mapping was set or changed by a human.
 *
 * RLS: readable/writable by project owner and accountant.
 */
export const accountMappingsTable = pgTable("account_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => annualReportProjectsTable.id, { onDelete: "cascade" }),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => importBatchesTable.id, { onDelete: "cascade" }),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name"),
  reportLine: text("report_line"),
  reportLineLabel: text("report_line_label"),
  basRange: text("bas_range"),
  confidence: mappingConfidenceEnum("confidence").notNull().default("unmapped"),
  status: mappingStatusEnum("status").notNull().default("unmapped"),
  noteImpactFlag: boolean("note_impact_flag").notNull().default(false),
  noteImpactMetadata: jsonb("note_impact_metadata"),
  isManualOverride: boolean("is_manual_override").notNull().default(false),
  overriddenByProfileId: uuid("overridden_by_profile_id").references(() => profilesTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAccountMappingSchema = createInsertSchema(accountMappingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAccountMapping = z.infer<typeof insertAccountMappingSchema>;
export type AccountMapping = typeof accountMappingsTable.$inferSelect;
