import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * companies — Swedish legal entities (AB, HB, KB, etc.).
 * organizationNumber maps to DB column "org_number" (Phase 1 naming preserved).
 * postalCode maps to DB column "zip_code" (Phase 1 naming preserved).
 * fiscalYearStart / fiscalYearEnd: MM-DD format, e.g. "01-01" / "12-31".
 * createdByProfileId: FK to profiles.id for user-scoped queries (added Phase 2).
 * Future RLS: users only see companies they own via createdByProfileId.
 */
export const companiesTable = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  organizationNumber: text("org_number").notNull().unique(),
  legalForm: text("legal_form").notNull().default("AB"),
  accountingFramework: text("accounting_framework").notNull().default("K3"),
  fiscalYearStart: text("fiscal_year_start").notNull().default("01-01"),
  fiscalYearEnd: text("fiscal_year_end").notNull().default("12-31"),
  address: text("address"),
  city: text("city"),
  postalCode: text("zip_code"),
  createdByProfileId: uuid("created_by_profile_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
