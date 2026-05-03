import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  cashFlowAccountClassificationEnum,
  cashFlowClassificationSourceEnum,
  mappingConfidenceEnum,
} from "./enums";
import { annualReportProjectsTable } from "./annualReportProjects";
import { profilesTable } from "./profiles";

/**
 * cash_flow_account_classifications — per-account cash-flow classification.
 *
 * Independent from the balance-sheet / income-statement mapping in
 * `account_mappings`, so the user can change how an account is treated for
 * cash-flow purposes without breaking the ordinary report mapping.
 *
 * Rows are populated by the cash-flow source-data layer:
 *   1. BAS-default classifier seeds rows from staging accounts.
 *   2. Existing report mapping refines confidence.
 *   3. User overrides are persisted with classificationSource = "manual_override".
 *
 * `excludeFromCashFlow` lets the user remove an account entirely from the
 * cash-flow derivation (e.g. an internal clearing account).
 *
 * `needsManualReview` marks accounts whose classification cannot be inferred
 * safely (e.g. movement could be either a new loan or amortisation).
 */
export const cashFlowAccountClassificationsTable = pgTable(
  "cash_flow_account_classifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => annualReportProjectsTable.id, { onDelete: "cascade" }),
    accountNumber: text("account_number").notNull(),
    accountName: text("account_name"),
    classification: cashFlowAccountClassificationEnum("classification")
      .notNull()
      .default("other_unclear"),
    classificationSource: cashFlowClassificationSourceEnum(
      "classification_source",
    )
      .notNull()
      .default("bas_default"),
    confidence: mappingConfidenceEnum("confidence")
      .notNull()
      .default("medium"),
    excludeFromCashFlow: boolean("exclude_from_cash_flow")
      .notNull()
      .default(false),
    needsManualReview: boolean("needs_manual_review")
      .notNull()
      .default(false),
    reviewReasonSv: text("review_reason_sv"),
    notes: text("notes"),
    overriddenByProfileId: uuid("overridden_by_profile_id").references(
      () => profilesTable.id,
      { onDelete: "set null" },
    ),
    overriddenAt: timestamp("overridden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    projectAccountIdx: uniqueIndex("cf_class_project_account_idx").on(
      t.projectId,
      t.accountNumber,
    ),
    projectIdx: index("cf_class_project_idx").on(t.projectId),
    classificationIdx: index("cf_class_classification_idx").on(t.classification),
  }),
);

export const insertCashFlowAccountClassificationSchema = createInsertSchema(
  cashFlowAccountClassificationsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertCashFlowAccountClassification = z.infer<
  typeof insertCashFlowAccountClassificationSchema
>;
export type CashFlowAccountClassification =
  typeof cashFlowAccountClassificationsTable.$inferSelect;
