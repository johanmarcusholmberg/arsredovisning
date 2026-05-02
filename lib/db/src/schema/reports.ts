import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const reportsTable = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  fiscalYearStart: text("fiscal_year_start").notNull(),
  fiscalYearEnd: text("fiscal_year_end").notNull(),
  status: text("status").notNull().default("draft"),
  accountingFramework: text("accounting_framework").notNull().default("K2"),
  completionPercent: integer("completion_percent").notNull().default(0),
  sectionsCompleted: integer("sections_completed").notNull().default(0),
  sectionsTotal: integer("sections_total").notNull().default(6),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
