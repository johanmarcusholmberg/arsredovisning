import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { mappingConfidenceEnum } from "./enums";

/**
 * mapping_rules — server-side BAS account range → K2/K3 report line rules.
 *
 * These are the canonical rules used by the auto-mapping engine.
 * Seeded from the Swedish BAS standard chart of accounts.
 *
 * accountRangeStart / accountRangeEnd: BAS account number bounds (inclusive).
 *   e.g. 1000–1099 = Intangible fixed assets (goodwill etc.)
 * reportLine: the target balance sheet or income statement line.
 * reportLineLabel: Swedish human-readable label.
 * accountingFramework: "K2" | "K3" | null (null = applies to both).
 * confidence: default confidence for auto-mappings using this rule.
 * noteImpactFlag: true if accounts in this range imply a mandatory note.
 * noteType: the note type key (e.g. "fixed_assets", "personnel", "loans").
 * priority: lower number = higher priority (for overlapping ranges).
 * isActive: false = rule disabled (for soft deletes / overrides).
 *
 * RLS: read-only for all authenticated users. Write via service role only.
 */
export const mappingRulesTable = pgTable("mapping_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountRangeStart: integer("account_range_start").notNull(),
  accountRangeEnd: integer("account_range_end").notNull(),
  reportLine: text("report_line").notNull(),
  reportLineLabel: text("report_line_label").notNull(),
  accountingFramework: text("accounting_framework"),
  confidence: mappingConfidenceEnum("confidence").notNull().default("high"),
  noteImpactFlag: boolean("note_impact_flag").notNull().default(false),
  noteType: text("note_type"),
  priority: integer("priority").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMappingRuleSchema = createInsertSchema(mappingRulesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMappingRule = z.infer<typeof insertMappingRuleSchema>;
export type MappingRule = typeof mappingRulesTable.$inferSelect;
