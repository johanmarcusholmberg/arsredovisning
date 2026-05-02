import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { companiesTable } from "./companies";

/**
 * project_snapshots — point-in-time snapshots of annual report project state.
 * Used for rollback, audit trail, and before/after comparisons.
 * snapshot_data: full serialised project state as JSONB.
 *
 * All three FK references are nullable with ON DELETE SET NULL — snapshots
 * survive deletion of the project, company, or actor profile. This preserves
 * the historical snapshot data even when referenced entities are removed.
 *
 * projectId intentionally has no .references() because project deletes may
 * happen before snapshots are cleaned up; keeping it as an unbound UUID
 * avoids FK constraint violations on project deletion.
 *
 * RLS: readable by profiles with project access; written only by service role.
 */
export const projectSnapshotsTable = pgTable("project_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id"),
  companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "set null" }),
  actorProfileId: uuid("actor_profile_id").references(() => profilesTable.id, { onDelete: "set null" }),
  label: text("label"),
  snapshotData: jsonb("snapshot_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProjectSnapshotSchema = createInsertSchema(projectSnapshotsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertProjectSnapshot = z.infer<typeof insertProjectSnapshotSchema>;
export type ProjectSnapshot = typeof projectSnapshotsTable.$inferSelect;
