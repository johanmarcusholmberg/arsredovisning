import {
  pgTable,
  uuid,
  timestamp,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reportsTable } from "./reports";
import { profilesTable } from "./profiles";
import { reportRoleEnum } from "./enums";

/**
 * report_collaborators — who has access to a report and in what role.
 *
 * Roles: owner, admin, accountant, reviewer, auditor, read_only.
 * Permission decisions are made by `lib/permissions.ts::can(role, action)`.
 *
 * inviteEmail is set when a collaborator is invited but no Supabase profile
 * yet exists for that email; once the user signs up, profileId is populated
 * and inviteEmail can be cleared.
 */
export const reportCollaboratorsTable = pgTable(
  "report_collaborators",
  {
    reportId: uuid("report_id")
      .notNull()
      .references(() => reportsTable.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    role: reportRoleEnum("role").notNull().default("read_only"),
    inviteEmail: text("invite_email"),
    invitedByProfileId: uuid("invited_by_profile_id")
      .references(() => profilesTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.reportId, t.profileId] }),
  }),
);

export const insertReportCollaboratorSchema = createInsertSchema(reportCollaboratorsTable).omit({
  createdAt: true,
});
export type InsertReportCollaborator = z.infer<typeof insertReportCollaboratorSchema>;
export type ReportCollaborator = typeof reportCollaboratorsTable.$inferSelect;
