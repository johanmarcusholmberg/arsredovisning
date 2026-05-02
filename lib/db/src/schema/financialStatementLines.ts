import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reportsTable } from "./reports";
import { accountingFrameworkEnum, statementTypeEnum, previousYearSourceEnum } from "./enums";

/**
 * financial_statement_lines — one row per line in a generated statement.
 * Linked to a specific annual report (reports table).
 *
 * lineKey: a stable machine-readable key (e.g. "net_revenue", "personnel_costs").
 * statementType: income_statement | balance_sheet | cash_flow
 * swedishLabel: the Swedish label shown in the report output.
 * isSubtotal / isTotal / isHeading: visual rendering hints.
 * currentYearAmount: SEK amount for the current fiscal year.
 * previousYearAmount: comparison year — null until imported or entered manually.
 * previousYearSource: how the previous-year value was supplied.
 * linkedAccountIds: comma-separated SIE account numbers mapped to this line.
 * isManuallyAdjusted: true when an accountant has overridden the imported amount.
 */
export const financialStatementLinesTable = pgTable("financial_statement_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reportsTable.id, { onDelete: "cascade" }),
  statementType: statementTypeEnum("statement_type").notNull(),
  lineKey: text("line_key").notNull(),
  swedishLabel: text("swedish_label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isSubtotal: boolean("is_subtotal").notNull().default(false),
  isTotal: boolean("is_total").notNull().default(false),
  isHeading: boolean("is_heading").notNull().default(false),
  currentYearAmount: numeric("current_year_amount", { precision: 18, scale: 2 }),
  previousYearAmount: numeric("previous_year_amount", { precision: 18, scale: 2 }),
  previousYearSource: previousYearSourceEnum("previous_year_source"),
  linkedAccountIds: text("linked_account_ids"),
  calculationMethod: text("calculation_method").notNull().default("sum"),
  mappingSource: text("mapping_source"),
  isManuallyAdjusted: boolean("is_manually_adjusted").notNull().default(false),
  manualAdjustmentOriginal: numeric("manual_adjustment_original", { precision: 18, scale: 2 }),
  manualAdjustmentReason: text("manual_adjustment_reason"),
  manualAdjustmentUserId: text("manual_adjustment_user_id"),
  manualAdjustmentAt: timestamp("manual_adjustment_at", { withTimezone: true }),
  framework: accountingFrameworkEnum("framework").notNull().default("K3"),
  noteReferenceText: text("note_reference_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFinancialStatementLineSchema = createInsertSchema(
  financialStatementLinesTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertFinancialStatementLine = z.infer<typeof insertFinancialStatementLineSchema>;
export type FinancialStatementLine = typeof financialStatementLinesTable.$inferSelect;
