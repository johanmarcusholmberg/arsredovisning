import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { importBatchesTable } from "./importBatches";
import { annualReportProjectsTable } from "./annualReportProjects";

/**
 * staging_balances — period balances (SIE #PSALDO / #PBUDGET) extracted during import.
 *
 * STAGING data only — not project data until the batch is confirmed.
 *
 * balanceType: "IB" (ingående/opening), "UB" (utgående/closing), "PSALDO" (period balance),
 *   "PBUDGET" (period budget).
 * yearOffset: SIE year offset (0 = current year, -1 = prior year).
 * period: YYYYMM period (for PSALDO/PBUDGET rows).
 *
 * RLS: accessible to project owner/accountant. Service role for mapping engine.
 */
export const stagingBalancesTable = pgTable("staging_balances", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => importBatchesTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => annualReportProjectsTable.id, { onDelete: "cascade" }),
  accountNumber: text("account_number").notNull(),
  balanceType: text("balance_type").notNull(),
  yearOffset: integer("year_offset").notNull().default(0),
  period: integer("period"),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("SEK"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStagingBalanceSchema = createInsertSchema(stagingBalancesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertStagingBalance = z.infer<typeof insertStagingBalanceSchema>;
export type StagingBalance = typeof stagingBalancesTable.$inferSelect;
