import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { accountingFrameworkEnum } from "./enums";

/**
 * companies — Swedish legal entities (AB, HB, KB, etc.).
 * organizationNumber is the Swedish organisationsnummer (e.g. "556123-4567").
 * legalForm: "AB" | "HB" | "KB" | "EK" | "HF" | etc. (kept as text — not a closed enum in Swedish law).
 * accountingFramework: "K2" | "K3" — enforced by accountingFrameworkEnum pgEnum.
 * createdByProfileId: FK to profiles.id — user who created this company record.
 *   Used for user-scoped queries (users only see companies they created).
 * ownerProfileId: nullable FK for future transfer-of-ownership / ownership tracking.
 * RLS: users only see companies where createdByProfileId = auth.uid() (via profiles lookup).
 */
export const companiesTable = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerProfileId: uuid("owner_profile_id").references(() => profilesTable.id),
  name: text("name").notNull(),
  organizationNumber: text("organization_number").notNull().unique(),
  legalForm: text("legal_form").notNull().default("AB"),
  accountingFramework: accountingFrameworkEnum("accounting_framework").notNull().default("K3"),
  fiscalYearStart: text("fiscal_year_start").notNull().default("01-01"),
  fiscalYearEnd: text("fiscal_year_end").notNull().default("12-31"),
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  createdByProfileId: uuid("created_by_profile_id"),
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
