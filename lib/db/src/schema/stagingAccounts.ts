import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { importBatchesTable } from "./importBatches";
import { annualReportProjectsTable } from "./annualReportProjects";

/**
 * staging_accounts — raw account rows extracted during import parsing.
 *
 * These rows are STAGING data — they do NOT become project data until the
 * associated import_batch is confirmed by the user.
 *
 * accountNumber: BAS chart-of-accounts number (e.g. "1510", "3000").
 * accountName: may be null if the SIE file omits names for some accounts.
 * openingBalance / closingBalance: as parsed from the SIE #IB/#UB records
 *   or computed from CSV/Excel rows. Stored as numeric for precision.
 * hasMissingName: convenience flag set when accountName is null — used in
 *   staging preview warnings.
 *
 * Once a batch is confirmed, the auto-mapper reads these rows and writes
 * account_mappings. Cancelled batches have their staging rows left in place
 * (they are never promoted and are excluded from all queries by batch.status).
 *
 * RLS: accessible to project owner/accountant. Service role for mapping engine.
 */
export const stagingAccountsTable = pgTable("staging_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => importBatchesTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => annualReportProjectsTable.id, { onDelete: "cascade" }),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name"),
  hasMissingName: boolean("has_missing_name").notNull().default(false),
  openingBalance: numeric("opening_balance", { precision: 18, scale: 2 }),
  closingBalance: numeric("closing_balance", { precision: 18, scale: 2 }),
  currency: text("currency").notNull().default("SEK"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStagingAccountSchema = createInsertSchema(stagingAccountsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertStagingAccount = z.infer<typeof insertStagingAccountSchema>;
export type StagingAccount = typeof stagingAccountsTable.$inferSelect;
