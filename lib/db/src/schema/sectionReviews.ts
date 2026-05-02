import {
  pgTable,
  uuid,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reportsTable } from "./reports";
import { profilesTable } from "./profiles";
import { reportSectionEnum, reviewStatusEnum } from "./enums";

/**
 * section_reviews — review state per (report, section). One row per
 * (reportId, section). Updated when a reviewer changes status or assignee.
 *
 * Sections: import | mapping | financial_statements | notes | validation | export
 */
export const sectionReviewsTable = pgTable(
  "section_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reportsTable.id, { onDelete: "cascade" }),
    section: reportSectionEnum("section").notNull(),
    status: reviewStatusEnum("status").notNull().default("not_started"),
    assignedToProfileId: uuid("assigned_to_profile_id")
      .references(() => profilesTable.id, { onDelete: "set null" }),
    updatedByProfileId: uuid("updated_by_profile_id")
      .references(() => profilesTable.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    reportSectionUnique: uniqueIndex("section_reviews_report_section_unique")
      .on(t.reportId, t.section),
  }),
);

export const insertSectionReviewSchema = createInsertSchema(sectionReviewsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSectionReview = z.infer<typeof insertSectionReviewSchema>;
export type SectionReview = typeof sectionReviewsTable.$inferSelect;
