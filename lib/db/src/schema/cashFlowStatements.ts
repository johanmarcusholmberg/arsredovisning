import {
  pgTable,
  text,
  timestamp,
  uuid,
  numeric,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { annualReportProjectsTable } from "./annualReportProjects";
import { reportsTable } from "./reports";
import { cashFlowStatementStatusEnum } from "./enums";

/**
 * cash_flow_statements — one row per project per financial year. Holds the
 * computed totals + reconciliation status. Line items live in
 * cash_flow_line_items, manual adjustments in cash_flow_adjustments.
 *
 * The indirect method is the only supported method at launch.
 */
export const cashFlowStatementsTable = pgTable(
  "cash_flow_statements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => annualReportProjectsTable.id, { onDelete: "cascade" }),
    reportId: uuid("report_id").references(() => reportsTable.id, {
      onDelete: "cascade",
    }),
    financialYear: text("financial_year").notNull(),
    method: text("method").notNull().default("indirect"),
    status: cashFlowStatementStatusEnum("status").notNull().default("draft"),

    openingCashAndCashEquivalents: numeric(
      "opening_cash_and_cash_equivalents",
      { precision: 18, scale: 2 },
    ),
    cashFlowFromOperatingActivities: numeric(
      "cash_flow_from_operating_activities",
      { precision: 18, scale: 2 },
    ),
    cashFlowFromInvestingActivities: numeric(
      "cash_flow_from_investing_activities",
      { precision: 18, scale: 2 },
    ),
    cashFlowFromFinancingActivities: numeric(
      "cash_flow_from_financing_activities",
      { precision: 18, scale: 2 },
    ),
    totalCashFlowForYear: numeric("total_cash_flow_for_year", {
      precision: 18,
      scale: 2,
    }),
    closingCashAndCashEquivalents: numeric(
      "closing_cash_and_cash_equivalents",
      { precision: 18, scale: 2 },
    ),
    calculatedClosingCashAndCashEquivalents: numeric(
      "calculated_closing_cash_and_cash_equivalents",
      { precision: 18, scale: 2 },
    ),
    reconciliationDifference: numeric("reconciliation_difference", {
      precision: 18,
      scale: 2,
    }),
    hasManualAdjustments: boolean("has_manual_adjustments")
      .notNull()
      .default(false),
    validationStatus: text("validation_status").notNull().default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    projectIdx: uniqueIndex("cf_stmt_project_year_idx").on(
      t.projectId,
      t.financialYear,
    ),
    reportIdx: index("cf_stmt_report_idx").on(t.reportId),
  }),
);

export const insertCashFlowStatementSchema = createInsertSchema(
  cashFlowStatementsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertCashFlowStatement = z.infer<
  typeof insertCashFlowStatementSchema
>;
export type CashFlowStatement = typeof cashFlowStatementsTable.$inferSelect;
