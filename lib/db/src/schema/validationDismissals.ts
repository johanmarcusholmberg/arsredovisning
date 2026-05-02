import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reportsTable } from "./reports";
import { profilesTable } from "./profiles";

/**
 * validation_dismissals — user-acknowledged warnings.
 *
 * issueKey is the deterministic ValidationIssue.ruleKey from the engine
 * (e.g. "note:5:missing_text", "balance_sheet:imbalance"). UNIQUE per
 * (report_id, issue_key) so re-dismissing the same issue is idempotent.
 *
 * High-risk dismissals require a comment (UI enforced; server validates too).
 * Blocking-level issues are NEVER dismissable.
 */
export const validationDismissalsTable = pgTable(
  "validation_dismissals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reportsTable.id, { onDelete: "cascade" }),
    issueKey: text("issue_key").notNull(),
    dismissedByProfileId: uuid("dismissed_by_profile_id")
      .references(() => profilesTable.id, { onDelete: "set null" }),
    isHighRisk: boolean("is_high_risk").notNull().default(false),
    requiresComment: boolean("requires_comment").notNull().default(false),
    comment: text("comment"),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    reportIssueUnique: uniqueIndex("validation_dismissals_report_issue_unique")
      .on(t.reportId, t.issueKey),
  }),
);

export const insertValidationDismissalSchema = createInsertSchema(validationDismissalsTable).omit({
  id: true,
  dismissedAt: true,
});
export type InsertValidationDismissal = z.infer<typeof insertValidationDismissalSchema>;
export type ValidationDismissal = typeof validationDismissalsTable.$inferSelect;
