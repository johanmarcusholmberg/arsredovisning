import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Shared pgEnum definitions for constrained columns.
 * Using enums ensures the DB enforces valid values and makes
 * the schema self-documenting.
 */

export const accountingFrameworkEnum = pgEnum("accounting_framework", ["K2", "K3"]);

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "in_review",
  "approved",
  "exported",
  "archived",
]);

export const annualReportLanguageEnum = pgEnum("annual_report_language", ["sv", "en"]);

export const projectRoleEnum = pgEnum("project_role", ["owner", "accountant", "viewer"]);

export const entitlementTypeEnum = pgEnum("entitlement_type", [
  "stripe_payment",
  "subscription",
  "manual_grant",
  "trial",
  "demo",
]);

export const uploadStatusEnum = pgEnum("upload_status", [
  "pending",
  "uploaded",
  "failed",
  "deleted",
]);

export const parseStatusEnum = pgEnum("parse_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const exportFormatEnum = pgEnum("export_format", ["pdf", "word", "excel"]);

export const exportStatusEnum = pgEnum("export_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const statementTypeEnum = pgEnum("statement_type", [
  "income_statement",
  "balance_sheet",
  "cash_flow",
]);

export const noteReferenceStatusEnum = pgEnum("note_reference_status", [
  "suggested",
  "active",
  "missing",
  "broken",
  "not_applicable",
]);

export const previousYearSourceEnum = pgEnum("previous_year_source", [
  "imported",
  "manual",
  "previous_report_placeholder",
]);

export const noteRequirementLevelEnum = pgEnum("note_requirement_level", [
  "required",
  "likely_required",
  "optional",
]);

export const noteStatusEnum = pgEnum("note_status", [
  "not_started",
  "suggested",
  "needs_review",
  "reviewed",
  "complete",
  "not_applicable",
  "missing_info",
]);

export const reportSectionEnum = pgEnum("report_section", [
  "import",
  "mapping",
  "financial_statements",
  "notes",
  "validation",
  "export",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "not_started",
  "in_progress",
  "ready_for_review",
  "changes_requested",
  "approved",
]);

export const validationLevelEnum = pgEnum("validation_level", [
  "blocking",
  "warning",
  "info",
]);

export const reportRoleEnum = pgEnum("report_role", [
  "owner",
  "admin",
  "accountant",
  "reviewer",
  "auditor",
  "read_only",
]);
