import {
  pgTable,
  uuid,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reportsTable } from "./reports";
import { profilesTable } from "./profiles";

/**
 * validation_runs — append-only history of every validation engine execution.
 *
 * summary holds aggregate counts (so listings don't need to crack open the
 * issues array). issues is the full serialised ValidationIssue[].
 */
export const validationRunsTable = pgTable("validation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reportsTable.id, { onDelete: "cascade" }),
  runByProfileId: uuid("run_by_profile_id")
    .references(() => profilesTable.id, { onDelete: "set null" }),
  blockingCount: integer("blocking_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),
  infoCount: integer("info_count").notNull().default(0),
  issues: jsonb("issues").notNull(),
  summary: jsonb("summary"),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertValidationRunSchema = createInsertSchema(validationRunsTable).omit({
  id: true,
  runAt: true,
});
export type InsertValidationRun = z.infer<typeof insertValidationRunSchema>;
export type ValidationRun = typeof validationRunsTable.$inferSelect;
