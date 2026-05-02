import { pgTable, text, timestamp, uuid, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { annualReportProjectsTable } from "./annualReportProjects";

/**
 * project_access — many-to-many: which profiles can access which projects, and in what role.
 * role: "owner" | "accountant" | "viewer"
 * Future RLS: Supabase RLS policies will use this table to enforce per-row access.
 * The combination (profileId, projectId) is the primary key — one row per profile per project.
 */
export const projectAccessTable = pgTable(
  "project_access",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profilesTable.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => annualReportProjectsTable.id),
    role: text("role").notNull().default("viewer"),
    grantedByProfileId: uuid("granted_by_profile_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.profileId, t.projectId] }),
  }),
);

export const insertProjectAccessSchema = createInsertSchema(projectAccessTable).omit({
  createdAt: true,
});
export type InsertProjectAccess = z.infer<typeof insertProjectAccessSchema>;
export type ProjectAccess = typeof projectAccessTable.$inferSelect;
