import {
  pgTable,
  text,
  timestamp,
  uuid,
  numeric,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cashFlowStatementsTable } from "./cashFlowStatements";
import { cashFlowSectionEnum, cashFlowSourceTypeEnum } from "./enums";

/**
 * cash_flow_line_items — one row per line of the indirect-method statement.
 * Each statement carries a fixed set of canonical lines (defined in
 * lib/cashFlowStatementService.ts CASH_FLOW_TEMPLATE) — they are seeded on
 * generation and may carry status badges in derived view models.
 */
export const cashFlowLineItemsTable = pgTable(
  "cash_flow_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cashFlowStatementId: uuid("cash_flow_statement_id")
      .notNull()
      .references(() => cashFlowStatementsTable.id, { onDelete: "cascade" }),
    section: cashFlowSectionEnum("section").notNull(),
    lineCode: text("line_code").notNull(),
    labelSv: text("label_sv").notNull(),
    amountCurrentYear: numeric("amount_current_year", {
      precision: 18,
      scale: 2,
    }),
    amountPreviousYear: numeric("amount_previous_year", {
      precision: 18,
      scale: 2,
    }),
    sourceType: cashFlowSourceTypeEnum("source_type")
      .notNull()
      .default("calculated"),
    sourceAccounts: text("source_accounts"),
    calculationExplanationSv: text("calculation_explanation_sv"),
    isEditable: boolean("is_editable").notNull().default(true),
    isRequired: boolean("is_required").notNull().default(false),
    isSubtotal: boolean("is_subtotal").notNull().default(false),
    needsReview: boolean("needs_review").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statementIdx: index("cf_line_statement_idx").on(t.cashFlowStatementId),
    sectionIdx: index("cf_line_section_idx").on(t.section),
  }),
);

export const insertCashFlowLineItemSchema = createInsertSchema(
  cashFlowLineItemsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertCashFlowLineItem = z.infer<
  typeof insertCashFlowLineItemSchema
>;
export type CashFlowLineItem = typeof cashFlowLineItemsTable.$inferSelect;
