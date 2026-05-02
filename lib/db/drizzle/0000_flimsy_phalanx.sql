CREATE TYPE "public"."accounting_framework" AS ENUM('K2', 'K3');--> statement-breakpoint
CREATE TYPE "public"."annual_report_language" AS ENUM('sv', 'en');--> statement-breakpoint
CREATE TYPE "public"."entitlement_type" AS ENUM('stripe_payment', 'subscription', 'manual_grant', 'trial', 'demo');--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('pdf', 'word', 'excel');--> statement-breakpoint
CREATE TYPE "public"."export_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."parse_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."project_role" AS ENUM('owner', 'accountant', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'in_review', 'approved', 'exported', 'archived');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('pending', 'uploaded', 'failed', 'deleted');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_id" text,
	"email" text NOT NULL,
	"display_name" text,
	"default_ui_language" text DEFAULT 'sv' NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_auth_id_unique" UNIQUE("auth_id"),
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"ui_language" text DEFAULT 'sv' NOT NULL,
	"theme" text DEFAULT 'light' NOT NULL,
	"notifications_placeholder" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_profile_id" uuid,
	"name" text NOT NULL,
	"organization_number" text NOT NULL,
	"legal_form" text DEFAULT 'AB' NOT NULL,
	"accounting_framework" "accounting_framework" DEFAULT 'K3' NOT NULL,
	"address" text,
	"city" text,
	"postal_code" text,
	"created_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_organization_number_unique" UNIQUE("organization_number")
);
--> statement-breakpoint
CREATE TABLE "annual_report_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"created_by_profile_id" uuid,
	"fiscal_year_start" date NOT NULL,
	"fiscal_year_end" date NOT NULL,
	"accounting_framework" "accounting_framework" DEFAULT 'K3' NOT NULL,
	"annual_report_language" "annual_report_language" DEFAULT 'sv' NOT NULL,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"note_numbering_scheme" text DEFAULT 'sequential' NOT NULL,
	"section_status_json" jsonb DEFAULT '{}'::jsonb,
	"imported_sie_file_name" text,
	"exported_pdf_url" text,
	"exported_word_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_access" (
	"profile_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"role" "project_role" DEFAULT 'viewer' NOT NULL,
	"granted_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_access_profile_id_project_id_pk" PRIMARY KEY("profile_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "project_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"profile_id" uuid,
	"entitlement_type" "entitlement_type" DEFAULT 'manual_grant' NOT NULL,
	"source" text DEFAULT 'manual_grant' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_subscription_id" text,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"project_id" uuid,
	"company_id" uuid,
	"actor_profile_id" uuid,
	"event_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"company_id" uuid,
	"actor_profile_id" uuid,
	"label" text,
	"snapshot_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"uploaded_by_profile_id" uuid,
	"storage_bucket" text NOT NULL,
	"storage_path" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer,
	"file_type" text NOT NULL,
	"upload_status" "upload_status" DEFAULT 'pending' NOT NULL,
	"parse_status" "parse_status",
	"note_numbering_state" jsonb,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"generated_by_profile_id" uuid,
	"storage_bucket" text DEFAULT 'exports' NOT NULL,
	"storage_path" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer,
	"format" "export_format" NOT NULL,
	"export_status" "export_status" DEFAULT 'pending' NOT NULL,
	"watermark" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"fiscal_year_start" text NOT NULL,
	"fiscal_year_end" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"accounting_framework" text DEFAULT 'K2' NOT NULL,
	"completion_percent" integer DEFAULT 0 NOT NULL,
	"sections_completed" integer DEFAULT 0 NOT NULL,
	"sections_total" integer DEFAULT 6 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_profile_id_profiles_id_fk" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_report_projects" ADD CONSTRAINT "annual_report_projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_report_projects" ADD CONSTRAINT "annual_report_projects_created_by_profile_id_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_access" ADD CONSTRAINT "project_access_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_access" ADD CONSTRAINT "project_access_project_id_annual_report_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."annual_report_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_access" ADD CONSTRAINT "project_access_granted_by_profile_id_profiles_id_fk" FOREIGN KEY ("granted_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_entitlements" ADD CONSTRAINT "project_entitlements_project_id_annual_report_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."annual_report_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_entitlements" ADD CONSTRAINT "project_entitlements_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_id_annual_report_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."annual_report_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_uploaded_by_profile_id_profiles_id_fk" FOREIGN KEY ("uploaded_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_files" ADD CONSTRAINT "export_files_project_id_annual_report_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."annual_report_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_files" ADD CONSTRAINT "export_files_generated_by_profile_id_profiles_id_fk" FOREIGN KEY ("generated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;