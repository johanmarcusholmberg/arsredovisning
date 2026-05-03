import { pgTable, text, timestamp, uuid, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * profiles — one row per authenticated user.
 * auth_id links to Supabase Auth uid (auth.users.id). Populated once
 * Supabase Auth is configured. Until then, profiles are created manually.
 * default_ui_language: overrides the system language for this user ("sv" | "en").
 * RLS: users can only read/write their own row (id = auth.uid()).
 */
export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  authId: text("auth_id").unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  defaultUiLanguage: text("default_ui_language").notNull().default("sv"),
  role: text("role").notNull().default("owner"),
  /**
   * Site-wide admin flag. Admins bypass entitlement gates and can grant
   * credits / entitlements to other users via /admin/* routes. NEVER expose
   * a way for ordinary users to flip this to true from the frontend.
   */
  isAdmin: boolean("is_admin").notNull().default(false),
  /**
   * Account status. "blocked" denies all authenticated API access (the
   * auth middleware short-circuits with 403). Only admins can change this
   * via POST /admin/users/:id/set-status. The bootstrap admin email is
   * protected and can never be blocked.
   */
  status: text("status").notNull().default("active"),
  /**
   * Last successful sign-in timestamp. Updated by the auth middleware
   * (best-effort, throttled to once per minute). Used by the admin user
   * table to surface stale accounts.
   */
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  /**
   * Number of unredeemed "real project" credits the user can spend. Each
   * POST /projects consumes one credit (atomically) and provisions an
   * active manual_grant entitlement for the new project. Granted by an
   * admin via /admin/users/:profileId/grant-credits.
   */
  availableProjectCredits: integer("available_project_credits").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
