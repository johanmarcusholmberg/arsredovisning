import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

/**
 * mapping_templates — reusable manual mapping overrides saved by users.
 *
 * A template captures a set of account number → report line overrides that
 * a user has found useful for a particular company or industry. It can be
 * applied to future import batches to avoid repeated manual work.
 *
 * mappingsJson: JSONB array of { accountNumber, reportLine, reportLineLabel }
 *   override entries saved as the template payload.
 *
 * createdByProfileId: the user who saved the template. Templates are owned by
 *   the creating user; future phases may allow org-level sharing.
 *
 * RLS: readable by the creating user; future: org-scoped read for shared templates.
 */
export const mappingTemplatesTable = pgTable("mapping_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  mappingsJson: jsonb("mappings_json")
    .$type<Array<{ accountNumber: string; reportLine: string; reportLineLabel: string }>>()
    .notNull()
    .default([]),
  createdByProfileId: uuid("created_by_profile_id")
    .notNull()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMappingTemplateSchema = createInsertSchema(mappingTemplatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMappingTemplate = z.infer<typeof insertMappingTemplateSchema>;
export type MappingTemplate = typeof mappingTemplatesTable.$inferSelect;
