import {
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  numeric,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { importBatchesTable } from "./importBatches";
import { annualReportProjectsTable } from "./annualReportProjects";

/**
 * staging_transactions — raw journal/verifikation rows extracted during import.
 *
 * STAGING data only — not project data until the batch is confirmed.
 *
 * verificationNumber: SIE #VER series + number (e.g. "A 1").
 * transactionDate: parsed from SIE #TRANS or CSV date column.
 * accountNumber: the BAS account debited or credited.
 * amount: positive = debit, negative = credit (Swedish SIE convention).
 * description: SIE #TRANS text field or CSV description column.
 * period: YYYYMM period if available (SIE #PSALDO, etc.).
 *
 * RLS: accessible to project owner/accountant. Service role for mapping engine.
 */
export const stagingTransactionsTable = pgTable("staging_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => importBatchesTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => annualReportProjectsTable.id, { onDelete: "cascade" }),
  verificationNumber: text("verification_number"),
  transactionDate: date("transaction_date"),
  accountNumber: text("account_number").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  description: text("description"),
  period: integer("period"),
  currency: text("currency").notNull().default("SEK"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStagingTransactionSchema = createInsertSchema(stagingTransactionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertStagingTransaction = z.infer<typeof insertStagingTransactionSchema>;
export type StagingTransaction = typeof stagingTransactionsTable.$inferSelect;
