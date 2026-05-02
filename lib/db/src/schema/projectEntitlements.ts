import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { annualReportProjectsTable } from "./annualReportProjects";

/**
 * project_entitlements — payment/access gate per project.
 * source: "stripe_payment" | "subscription" | "manual_grant" | "trial"
 * stripePaymentIntentId / stripeSubscriptionId: populated in Phase 4 when Stripe is wired.
 * isActive: false means the entitlement has expired or been revoked.
 * Future: Phase 4 will add Stripe webhook handlers that update this table.
 * Until Phase 4, real project creation is blocked at the UI level (payment gate screen).
 */
export const projectEntitlementsTable = pgTable("project_entitlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => annualReportProjectsTable.id),
  source: text("source").notNull().default("manual_grant"),
  isActive: boolean("is_active").notNull().default(true),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProjectEntitlementSchema = createInsertSchema(
  projectEntitlementsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProjectEntitlement = z.infer<typeof insertProjectEntitlementSchema>;
export type ProjectEntitlement = typeof projectEntitlementsTable.$inferSelect;
