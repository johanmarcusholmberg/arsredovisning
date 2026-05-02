import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
