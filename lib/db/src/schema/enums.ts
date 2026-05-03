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

export const importFileTypeEnum = pgEnum("import_file_type", ["sie", "csv", "excel"]);

export const batchStatusEnum = pgEnum("batch_status", [
  "pending",
  "parsing",
  "partial",
  "parsed",
  "failed",
  "confirmed",
  "cancelled",
]);

export const mappingConfidenceEnum = pgEnum("mapping_confidence", [
  "high",
  "medium",
  "low",
  "unmapped",
]);

export const mappingStatusEnum = pgEnum("mapping_status", [
  "auto_mapped",
  "suggested",
  "needs_review",
  "manually_mapped",
  "unmapped",
]);

// Phase 6.5 — reclassification & netting between notes
export const reclassificationSuggestionStatusEnum = pgEnum(
  "reclassification_suggestion_status",
  ["suggested", "accepted", "rejected", "edited", "not_relevant"],
);

export const reclassificationStatusEnum = pgEnum("reclassification_status", [
  "active",
  "undone",
]);

export const reclassificationConfidenceEnum = pgEnum("reclassification_confidence", [
  "high",
  "medium",
  "low",
]);

export const reclassificationEffectTypeEnum = pgEnum("reclassification_effect_type", [
  "note_only",
  "report_node_only",
  "note_and_report_node",
]);

// ── Phase 7+: Cash flow statement (Kassaflödesanalys) ──────────────────────
export const cashFlowRequirementEnum = pgEnum("cash_flow_requirement", [
  "mandatory",
  "optional",
  "not_supported",
  "unknown",
]);

export const cashFlowAssessmentStatusEnum = pgEnum("cash_flow_assessment_status", [
  "calculated",
  "needs_user_confirmation",
  "manually_overridden",
]);

export const cashFlowLargerCompanyEnum = pgEnum("cash_flow_larger_company", [
  "true",
  "false",
  "unknown",
]);

export const cashFlowReportTypeEnum = pgEnum("cash_flow_report_type", [
  "annual_report",
  "group_report",
]);

export const cashFlowStatementStatusEnum = pgEnum("cash_flow_statement_status", [
  "draft",
  "needs_review",
  "validated",
  "blocked",
]);

export const cashFlowSectionEnum = pgEnum("cash_flow_section", [
  "operating",
  "investing",
  "financing",
  "reconciliation",
]);

export const cashFlowSourceTypeEnum = pgEnum("cash_flow_source_type", [
  "mapped_accounts",
  "calculated",
  "manual_adjustment",
  "imported_value",
]);

/**
 * Cash-flow account classification — the per-account category used to
 * derive the indirect-method statement. Independent from the balance-sheet /
 * income-statement mapping so the user can re-classify for cash-flow
 * purposes without disturbing the ordinary report mapping.
 */
export const cashFlowAccountClassificationEnum = pgEnum(
  "cash_flow_account_classification",
  [
    "cash_and_cash_equivalents",
    "receivables",
    "inventory",
    "operating_liabilities",
    "tax",
    "non_cash_adjustment",
    "tangible_fixed_assets",
    "intangible_fixed_assets",
    "financial_fixed_assets",
    "long_term_loans",
    "short_term_interest_bearing_loans",
    "equity",
    "dividends",
    "other_unclear",
    "exclude",
  ],
);

/**
 * Where an account's cash-flow classification came from.
 *   bas_default        — derived from BAS account ranges
 *   report_mapping     — inferred from the existing balance-sheet mapping
 *   manual_override    — user explicitly chose / overrode it
 */
export const cashFlowClassificationSourceEnum = pgEnum(
  "cash_flow_classification_source",
  ["bas_default", "report_mapping", "manual_override"],
);
