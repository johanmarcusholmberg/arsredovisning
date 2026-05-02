CREATE TYPE "public"."reclassification_suggestion_status" AS ENUM('suggested', 'accepted', 'rejected', 'edited', 'not_relevant');--> statement-breakpoint
CREATE TYPE "public"."reclassification_status" AS ENUM('active', 'undone');--> statement-breakpoint
CREATE TYPE "public"."reclassification_confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."reclassification_effect_type" AS ENUM('note_only', 'report_node_only', 'note_and_report_node');--> statement-breakpoint
CREATE TABLE "annual_report_reclassification_suggestions" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"report_id" uuid NOT NULL,
"source_note_row_id" uuid,
"target_note_row_id" uuid,
"source_label" text,
"target_label" text,
"source_account_number" text,
"target_account_number" text,
"suggested_amount" numeric(18,2) NOT NULL,
"confidence_level" "reclassification_confidence" NOT NULL,
"rule_key" text NOT NULL,
"explanation" text NOT NULL,
"detail_json" jsonb,
"effect_type" "reclassification_effect_type" DEFAULT 'note_only' NOT NULL,
"status" "reclassification_suggestion_status" DEFAULT 'suggested' NOT NULL,
"reviewed_by_profile_id" uuid,
"reviewed_at" timestamp with time zone,
"reviewer_comment" text,
"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annual_report_reclassifications" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"report_id" uuid NOT NULL,
"source_suggestion_id" uuid,
"source_note_row_id" uuid,
"target_note_row_id" uuid NOT NULL,
"source_label" text,
"target_label" text,
"amount" numeric(18,2) NOT NULL,
"effect_type" "reclassification_effect_type" DEFAULT 'note_only' NOT NULL,
"reason" text,
"status" "reclassification_status" DEFAULT 'active' NOT NULL,
"created_by_profile_id" uuid,
"undone_at" timestamp with time zone,
"undone_by_profile_id" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annual_report_reclassification_audit_log" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"report_id" uuid NOT NULL,
"suggestion_id" uuid,
"reclassification_id" uuid,
"event_type" text NOT NULL,
"actor_profile_id" uuid,
"payload_json" jsonb,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "annual_report_reclassification_suggestions" ADD CONSTRAINT "annual_report_reclassification_suggestions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_report_reclassification_suggestions" ADD CONSTRAINT "annual_report_reclassification_suggestions_source_note_row_id_report_note_rows_id_fk" FOREIGN KEY ("source_note_row_id") REFERENCES "public"."report_note_rows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_report_reclassification_suggestions" ADD CONSTRAINT "annual_report_reclassification_suggestions_target_note_row_id_report_note_rows_id_fk" FOREIGN KEY ("target_note_row_id") REFERENCES "public"."report_note_rows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_report_reclassification_suggestions" ADD CONSTRAINT "annual_report_reclassification_suggestions_reviewed_by_profile_id_profiles_id_fk" FOREIGN KEY ("reviewed_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_report_reclassifications" ADD CONSTRAINT "annual_report_reclassifications_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_report_reclassifications" ADD CONSTRAINT "annual_report_reclassifications_source_suggestion_id_annual_report_reclassification_suggestions_id_fk" FOREIGN KEY ("source_suggestion_id") REFERENCES "public"."annual_report_reclassification_suggestions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_report_reclassifications" ADD CONSTRAINT "annual_report_reclassifications_source_note_row_id_report_note_rows_id_fk" FOREIGN KEY ("source_note_row_id") REFERENCES "public"."report_note_rows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_report_reclassifications" ADD CONSTRAINT "annual_report_reclassifications_target_note_row_id_report_note_rows_id_fk" FOREIGN KEY ("target_note_row_id") REFERENCES "public"."report_note_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_report_reclassifications" ADD CONSTRAINT "annual_report_reclassifications_created_by_profile_id_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_report_reclassifications" ADD CONSTRAINT "annual_report_reclassifications_undone_by_profile_id_profiles_id_fk" FOREIGN KEY ("undone_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_report_reclassification_audit_log" ADD CONSTRAINT "annual_report_reclassification_audit_log_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_report_reclassification_audit_log" ADD CONSTRAINT "annual_report_reclassification_audit_log_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ar_recl_suggestions_report_id_idx" ON "annual_report_reclassification_suggestions" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "ar_recl_suggestions_status_idx" ON "annual_report_reclassification_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ar_recl_report_id_idx" ON "annual_report_reclassifications" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "ar_recl_source_row_idx" ON "annual_report_reclassifications" USING btree ("source_note_row_id");--> statement-breakpoint
CREATE INDEX "ar_recl_target_row_idx" ON "annual_report_reclassifications" USING btree ("target_note_row_id");--> statement-breakpoint
CREATE INDEX "ar_recl_status_idx" ON "annual_report_reclassifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ar_recl_audit_report_id_idx" ON "annual_report_reclassification_audit_log" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "ar_recl_audit_suggestion_idx" ON "annual_report_reclassification_audit_log" USING btree ("suggestion_id");--> statement-breakpoint
CREATE INDEX "ar_recl_audit_reclassification_idx" ON "annual_report_reclassification_audit_log" USING btree ("reclassification_id");
