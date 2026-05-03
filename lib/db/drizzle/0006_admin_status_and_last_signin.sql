-- Phase: admin backend
-- Adds account status (active|blocked) and last_sign_in_at to profiles.
-- Idempotent so it can be re-applied safely.

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "last_sign_in_at" timestamp with time zone;
