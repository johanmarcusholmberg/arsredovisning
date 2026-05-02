import {
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { annualReportProjectsTable } from "./annualReportProjects";
import { accountMappingsTable } from "./accountMappings";
import { profilesTable } from "./profiles";

/**
 * mapping_overrides — audit trail for manual mapping changes.
 *
 * Every time a user overrides an auto-mapped account, a row is inserted here.
 * The actual current mapping lives in account_mappings (isManualOverride=true).
 * This table provides the full history of changes for a given account mapping.
 *
 * previousReportLine / newReportLine: the before/after report line values.
 * reason: optional free-text note from the user explaining the override.
 *
 * IMPORTANT: Never update or delete rows from this table.
 * RLS: readable by project owner/accountant; inserts via service role.
 */
export const mappingOverridesTable = pgTable("mapping_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => annualReportProjectsTable.id, { onDelete: "cascade" }),
  accountMappingId: uuid("account_mapping_id")
    .notNull()
    .references(() => accountMappingsTable.id, { onDelete: "cascade" }),
  accountNumber: text("account_number").notNull(),
  previousReportLine: text("previous_report_line"),
  newReportLine: text("new_report_line").notNull(),
  reason: text("reason"),
  overriddenByProfileId: uuid("overridden_by_profile_id").references(() => profilesTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMappingOverrideSchema = createInsertSchema(mappingOverridesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMappingOverride = z.infer<typeof insertMappingOverrideSchema>;
export type MappingOverride = typeof mappingOverridesTable.$inferSelect;
