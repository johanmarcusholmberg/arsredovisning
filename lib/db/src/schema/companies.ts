import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  orgNumber: text("org_number").notNull(),
  legalForm: text("legal_form").notNull(),
  address: text("address"),
  zipCode: text("zip_code"),
  city: text("city"),
  accountingFramework: text("accounting_framework").notNull().default("K2"),
  fiscalYearStart: text("fiscal_year_start").notNull().default("01-01"),
  fiscalYearEnd: text("fiscal_year_end").notNull().default("12-31"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
