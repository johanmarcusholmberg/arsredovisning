import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reportsTable } from "./reports";
import { profilesTable } from "./profiles";
import { reportSectionEnum } from "./enums";

/**
 * section_comments — threaded comments per report section.
 *
 * entityId is an optional free-form UUID linking the comment to a specific
 * entity (note id, statement line id, etc). Frontend interprets it based on
 * section context. Resolved comments stay in the thread but render muted.
 */
export const sectionCommentsTable = pgTable("section_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reportsTable.id, { onDelete: "cascade" }),
  section: reportSectionEnum("section").notNull(),
  entityId: uuid("entity_id"),
  body: text("body").notNull(),
  createdByProfileId: uuid("created_by_profile_id")
    .references(() => profilesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedByProfileId: uuid("resolved_by_profile_id")
    .references(() => profilesTable.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const insertSectionCommentSchema = createInsertSchema(sectionCommentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSectionComment = z.infer<typeof insertSectionCommentSchema>;
export type SectionComment = typeof sectionCommentsTable.$inferSelect;
