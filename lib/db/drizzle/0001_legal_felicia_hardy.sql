CREATE TYPE "public"."batch_status" AS ENUM('pending', 'parsing', 'partial', 'parsed', 'failed', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."import_file_type" AS ENUM('sie', 'csv', 'excel');--> statement-breakpoint
CREATE TYPE "public"."mapping_confidence" AS ENUM('high', 'medium', 'low', 'unmapped');--> statement-breakpoint
CREATE TYPE "public"."mapping_status" AS ENUM('auto_mapped', 'suggested', 'needs_review', 'manually_mapped', 'unmapped');--> statement-breakpoint
CREATE TYPE "public"."note_reference_status" AS ENUM('suggested', 'active', 'missing', 'broken', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."note_requirement_level" AS ENUM('required', 'likely_required', 'optional');--> statement-breakpoint
CREATE TYPE "public"."note_status" AS ENUM('not_started', 'suggested', 'needs_review', 'reviewed', 'complete', 'not_applicable', 'missing_info');--> statement-breakpoint
CREATE TYPE "public"."previous_year_source" AS ENUM('imported', 'manual', 'previous_report_placeholder');--> statement-breakpoint
CREATE TYPE "public"."report_role" AS ENUM('owner', 'admin', 'accountant', 'reviewer', 'auditor', 'read_only');--> statement-breakpoint
CREATE TYPE "public"."report_section" AS ENUM('import', 'mapping', 'financial_statements', 'notes', 'validation', 'export');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('not_started', 'in_progress', 'ready_for_review', 'changes_requested', 'approved');--> statement-breakpoint
CREATE TYPE "public"."statement_type" AS ENUM('income_statement', 'balance_sheet', 'cash_flow');--> statement-breakpoint
CREATE TYPE "public"."validation_level" AS ENUM('blocking', 'warning', 'info');--> statement-breakpoint
CREATE TABLE "financial_statement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"statement_type" "statement_type" NOT NULL,
	"line_key" text NOT NULL,
	"swedish_label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_subtotal" boolean DEFAULT false NOT NULL,
	"is_total" boolean DEFAULT false NOT NULL,
	"is_heading" boolean DEFAULT false NOT NULL,
	"current_year_amount" numeric(18, 2),
	"previous_year_amount" numeric(18, 2),
	"previous_year_source" "previous_year_source",
	"linked_account_ids" text,
	"calculation_method" text DEFAULT 'sum' NOT NULL,
	"mapping_source" text,
	"is_manually_adjusted" boolean DEFAULT false NOT NULL,
	"manual_adjustment_original" numeric(18, 2),
	"manual_adjustment_reason" text,
	"manual_adjustment_user_id" text,
	"manual_adjustment_at" timestamp with time zone,
	"framework" "accounting_framework" DEFAULT 'K3' NOT NULL,
	"note_reference_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_note_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"statement_type" "statement_type" NOT NULL,
	"financial_statement_line_id" uuid NOT NULL,
	"note_id" uuid,
	"suggested_note_type" text,
	"reference_status" "note_reference_status" DEFAULT 'suggested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"note_number" integer,
	"note_type" text NOT NULL,
	"title" text NOT NULL,
	"requirement_level" "note_requirement_level" DEFAULT 'optional' NOT NULL,
	"status" "note_status" DEFAULT 'not_started' NOT NULL,
	"framework" "accounting_framework" DEFAULT 'K3' NOT NULL,
	"source_trigger" text,
	"linked_statement_lines" jsonb,
	"linked_account_groups" jsonb,
	"current_year_value" numeric(18, 2),
	"previous_year_value" numeric(18, 2),
	"suggested_text" text,
	"accepted_text" text,
	"accepted_by_profile_id" uuid,
	"accepted_at" timestamp with time zone,
	"text_is_ai_generated" boolean DEFAULT false NOT NULL,
	"requires_user_confirmation" boolean DEFAULT false NOT NULL,
	"confirmed_by_user" boolean DEFAULT false NOT NULL,
	"confirmed_by_profile_id" uuid,
	"confirmed_at" timestamp with time zone,
	"confirmation_comment" text,
	"manual_number_override" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_note_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"row_key" text NOT NULL,
	"label" text NOT NULL,
	"current_year_amount" numeric(18, 2),
	"previous_year_amount" numeric(18, 2),
	"is_subtotal" boolean DEFAULT false NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"source_account_ranges" jsonb,
	"source_account_ids" jsonb,
	"calculation_note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_statement_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"statement_type" "statement_type" NOT NULL,
	"line_key" text NOT NULL,
	"display_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"run_by_profile_id" uuid,
	"blocking_count" integer DEFAULT 0 NOT NULL,
	"warning_count" integer DEFAULT 0 NOT NULL,
	"info_count" integer DEFAULT 0 NOT NULL,
	"issues" jsonb NOT NULL,
	"summary" jsonb,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"issue_key" text NOT NULL,
	"dismissed_by_profile_id" uuid,
	"is_high_risk" boolean DEFAULT false NOT NULL,
	"requires_comment" boolean DEFAULT false NOT NULL,
	"comment" text,
	"dismissed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"section" "report_section" NOT NULL,
	"status" "review_status" DEFAULT 'not_started' NOT NULL,
	"assigned_to_profile_id" uuid,
	"updated_by_profile_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"section" "report_section" NOT NULL,
	"entity_id" uuid,
	"body" text NOT NULL,
	"created_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_by_profile_id" uuid,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "report_collaborators" (
	"report_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"role" "report_role" DEFAULT 'read_only' NOT NULL,
	"invite_email" text,
	"invited_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_collaborators_report_id_profile_id_pk" PRIMARY KEY("report_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"uploaded_by_profile_id" uuid,
	"original_filename" text NOT NULL,
	"file_type" "import_file_type" NOT NULL,
	"file_size_bytes" integer,
	"storage_bucket" text,
	"storage_path" text,
	"status" "batch_status" DEFAULT 'pending' NOT NULL,
	"fiscal_year_detected" text,
	"accounts_found" integer DEFAULT 0,
	"balances_found" integer DEFAULT 0,
	"transactions_found" integer DEFAULT 0,
	"parsing_errors" jsonb DEFAULT '[]'::jsonb,
	"summary_json" jsonb,
	"confirmed_at" timestamp with time zone,
	"confirmed_by_profile_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staging_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text,
	"has_missing_name" boolean DEFAULT false NOT NULL,
	"opening_balance" numeric(18, 2),
	"closing_balance" numeric(18, 2),
	"currency" text DEFAULT 'SEK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staging_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"verification_number" text,
	"transaction_date" date,
	"account_number" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"description" text,
	"period" integer,
	"currency" text DEFAULT 'SEK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staging_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"account_number" text NOT NULL,
	"balance_type" text NOT NULL,
	"year_offset" integer DEFAULT 0 NOT NULL,
	"period" integer,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text DEFAULT 'SEK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text,
	"report_line" text,
	"report_line_label" text,
	"bas_range" text,
	"confidence" "mapping_confidence" DEFAULT 'unmapped' NOT NULL,
	"status" "mapping_status" DEFAULT 'unmapped' NOT NULL,
	"note_impact_flag" boolean DEFAULT false NOT NULL,
	"note_impact_metadata" jsonb,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"overridden_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mapping_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_range_start" integer NOT NULL,
	"account_range_end" integer NOT NULL,
	"report_line" text NOT NULL,
	"report_line_label" text NOT NULL,
	"accounting_framework" text,
	"confidence" "mapping_confidence" DEFAULT 'high' NOT NULL,
	"note_impact_flag" boolean DEFAULT false NOT NULL,
	"note_type" text,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mapping_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"account_mapping_id" uuid NOT NULL,
	"account_number" text NOT NULL,
	"previous_report_line" text,
	"new_report_line" text NOT NULL,
	"reason" text,
	"overridden_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mapping_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"mappings_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_statement_lines" ADD CONSTRAINT "financial_statement_lines_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_note_references" ADD CONSTRAINT "report_note_references_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_note_references" ADD CONSTRAINT "report_note_references_financial_statement_line_id_financial_statement_lines_id_fk" FOREIGN KEY ("financial_statement_line_id") REFERENCES "public"."financial_statement_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_notes" ADD CONSTRAINT "report_notes_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_note_rows" ADD CONSTRAINT "report_note_rows_note_id_report_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."report_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_statement_references" ADD CONSTRAINT "note_statement_references_note_id_report_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."report_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_run_by_profile_id_profiles_id_fk" FOREIGN KEY ("run_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_dismissals" ADD CONSTRAINT "validation_dismissals_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_dismissals" ADD CONSTRAINT "validation_dismissals_dismissed_by_profile_id_profiles_id_fk" FOREIGN KEY ("dismissed_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_reviews" ADD CONSTRAINT "section_reviews_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_reviews" ADD CONSTRAINT "section_reviews_assigned_to_profile_id_profiles_id_fk" FOREIGN KEY ("assigned_to_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_reviews" ADD CONSTRAINT "section_reviews_updated_by_profile_id_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_comments" ADD CONSTRAINT "section_comments_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_comments" ADD CONSTRAINT "section_comments_created_by_profile_id_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_comments" ADD CONSTRAINT "section_comments_resolved_by_profile_id_profiles_id_fk" FOREIGN KEY ("resolved_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_collaborators" ADD CONSTRAINT "report_collaborators_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_collaborators" ADD CONSTRAINT "report_collaborators_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_collaborators" ADD CONSTRAINT "report_collaborators_invited_by_profile_id_profiles_id_fk" FOREIGN KEY ("invited_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_project_id_annual_report_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."annual_report_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_uploaded_by_profile_id_profiles_id_fk" FOREIGN KEY ("uploaded_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_confirmed_by_profile_id_profiles_id_fk" FOREIGN KEY ("confirmed_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_accounts" ADD CONSTRAINT "staging_accounts_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_accounts" ADD CONSTRAINT "staging_accounts_project_id_annual_report_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."annual_report_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_transactions" ADD CONSTRAINT "staging_transactions_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_transactions" ADD CONSTRAINT "staging_transactions_project_id_annual_report_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."annual_report_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_balances" ADD CONSTRAINT "staging_balances_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_balances" ADD CONSTRAINT "staging_balances_project_id_annual_report_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."annual_report_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_project_id_annual_report_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."annual_report_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_overridden_by_profile_id_profiles_id_fk" FOREIGN KEY ("overridden_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_overrides" ADD CONSTRAINT "mapping_overrides_project_id_annual_report_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."annual_report_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_overrides" ADD CONSTRAINT "mapping_overrides_account_mapping_id_account_mappings_id_fk" FOREIGN KEY ("account_mapping_id") REFERENCES "public"."account_mappings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_overrides" ADD CONSTRAINT "mapping_overrides_overridden_by_profile_id_profiles_id_fk" FOREIGN KEY ("overridden_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_templates" ADD CONSTRAINT "mapping_templates_created_by_profile_id_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "report_notes_report_id_note_type_unique" ON "report_notes" USING btree ("report_id","note_type");--> statement-breakpoint
CREATE INDEX "report_note_rows_note_id_idx" ON "report_note_rows" USING btree ("note_id");--> statement-breakpoint
CREATE UNIQUE INDEX "validation_dismissals_report_issue_unique" ON "validation_dismissals" USING btree ("report_id","issue_key");--> statement-breakpoint
CREATE UNIQUE INDEX "section_reviews_report_section_unique" ON "section_reviews" USING btree ("report_id","section");