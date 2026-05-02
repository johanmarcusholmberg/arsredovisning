import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

/**
 * user_preferences — per-user UI and notification preferences.
 * One row per profile. Created lazily on first login or preference update.
 * RLS: users can only read/write their own row (profile_id = auth.uid()).
 */
export const userPreferencesTable = pgTable("user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .unique()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  uiLanguage: text("ui_language").notNull().default("sv"),
  theme: text("theme").notNull().default("light"),
  emailWeeklySummary: boolean("email_weekly_summary").notNull().default(true),
  deadlineAlertsEnabled: boolean("deadline_alerts_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferencesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferencesTable.$inferSelect;
