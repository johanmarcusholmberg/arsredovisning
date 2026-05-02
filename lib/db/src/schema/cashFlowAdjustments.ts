import {
  pgTable,
  text,
  timestamp,
  uuid,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cashFlowStatementsTable } from "./cashFlowStatements";
import { cashFlowLineItemsTable } from "./cashFlowLineItems";
import { profilesTable } from "./profiles";

/**
 * cash_flow_adjustments — append-only audit log of manual adjustments to
 * cash flow line items. Every manual edit must capture who, when, why,
 * previous and new value.
 */
export const cashFlowAdjustmentsTable = pgTable(
  "cash_flow_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cashFlowStatementId: uuid("cash_flow_statement_id")
      .notNull()
      .references(() => cashFlowStatementsTable.id, { onDelete: "cascade" }),
    lineItemId: uuid("line_item_id")
      .notNull()
      .references(() => cashFlowLineItemsTable.id, { onDelete: "cascade" }),
    adjustmentAmount: numeric("adjustment_amount", {
      precision: 18,
      scale: 2,
    }).notNull(),
    adjustmentReason: text("adjustment_reason").notNull(),
    previousAmount: numeric("previous_amount", { precision: 18, scale: 2 }),
    newAmount: numeric("new_amount", { precision: 18, scale: 2 }).notNull(),
    createdByProfileId: uuid("created_by_profile_id").references(
      () => profilesTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statementIdx: index("cf_adj_statement_idx").on(t.cashFlowStatementId),
    lineItemIdx: index("cf_adj_line_item_idx").on(t.lineItemId),
  }),
);

export const insertCashFlowAdjustmentSchema = createInsertSchema(
  cashFlowAdjustmentsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertCashFlowAdjustment = z.infer<
  typeof insertCashFlowAdjustmentSchema
>;
export type CashFlowAdjustment = typeof cashFlowAdjustmentsTable.$inferSelect;
