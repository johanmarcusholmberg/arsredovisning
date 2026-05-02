import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * profiles — one row per authenticated user.
 * In Phase 2, this will be linked 1:1 to Supabase Auth uid.
 * Future RLS: users can only read/write their own row.
 */
export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  authId: text("auth_id").unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
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
