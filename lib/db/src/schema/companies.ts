import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * companies — Swedish legal entities (AB, HB, KB, etc.).
 * organizationNumber is the Swedish organisationsnummer (e.g. "556123-4567").
 * legalForm: "AB" | "HB" | "KB" | "EK" | "HF" | etc.
 * accountingFramework: "K2" | "K3" — determines which notes are required.
 * Future RLS: users only see companies they have access to via project_access.
 */
export const companiesTable = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  organizationNumber: text("organization_number").notNull().unique(),
  legalForm: text("legal_form").notNull().default("AB"),
  accountingFramework: text("accounting_framework").notNull().default("K3"),
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
