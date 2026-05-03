-- Re-apply Row Level Security policies for all tables documented in
-- docs/rls-policies.sql. Mirrors that file exactly except for one
-- platform difference: this project's live Postgres is Replit's built-in
-- Postgres (not Supabase) and does not expose the `auth.uid()` helper.
-- We therefore use `current_setting('request.jwt.claim.sub', true)` —
-- the same JWT sub claim Supabase populates — and the `auth_profile_id()`
-- helper installed in 0004_phase_6_5_rls_function.sql.
--
-- The API server connects with the service role / superuser DB URL, which
-- bypasses RLS, so these policies only matter for direct browser/anon-role
-- queries. They are nonetheless required by the project's security posture
-- (see replit.md § Database migrations).
--
-- Idempotent: every ENABLE/POLICY uses IF NOT EXISTS / OR REPLACE patterns
-- so the file can be re-applied safely.

-- ─── helper: jwt sub presence (replaces `auth.uid() IS NOT NULL`) ──────
-- Inlined directly in policies below as
--   current_setting('request.jwt.claim.sub', true) IS NOT NULL

-- ─── profiles ─────────────────────────────────────────────────────────
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "profiles: own row read" ON "profiles";
--> statement-breakpoint
CREATE POLICY "profiles: own row read" ON "profiles" FOR SELECT
  USING (auth_id = current_setting('request.jwt.claim.sub', true));
--> statement-breakpoint
DROP POLICY IF EXISTS "profiles: own row insert" ON "profiles";
--> statement-breakpoint
CREATE POLICY "profiles: own row insert" ON "profiles" FOR INSERT
  WITH CHECK (auth_id = current_setting('request.jwt.claim.sub', true));
--> statement-breakpoint
DROP POLICY IF EXISTS "profiles: own row update" ON "profiles";
--> statement-breakpoint
CREATE POLICY "profiles: own row update" ON "profiles" FOR UPDATE
  USING (auth_id = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (auth_id = current_setting('request.jwt.claim.sub', true));
--> statement-breakpoint

-- ─── user_preferences ─────────────────────────────────────────────────
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "user_preferences: own row read" ON "user_preferences";
--> statement-breakpoint
CREATE POLICY "user_preferences: own row read" ON "user_preferences" FOR SELECT
  USING (profile_id = auth_profile_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "user_preferences: own row insert" ON "user_preferences";
--> statement-breakpoint
CREATE POLICY "user_preferences: own row insert" ON "user_preferences" FOR INSERT
  WITH CHECK (profile_id = auth_profile_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "user_preferences: own row update" ON "user_preferences";
--> statement-breakpoint
CREATE POLICY "user_preferences: own row update" ON "user_preferences" FOR UPDATE
  USING (profile_id = auth_profile_id())
  WITH CHECK (profile_id = auth_profile_id());
--> statement-breakpoint

-- ─── companies ────────────────────────────────────────────────────────
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "companies: read via project access" ON "companies";
--> statement-breakpoint
CREATE POLICY "companies: read via project access" ON "companies" FOR SELECT
  USING (
    id IN (
      SELECT arp.company_id FROM annual_report_projects arp
      INNER JOIN project_access pa ON pa.project_id = arp.id
      WHERE pa.profile_id = auth_profile_id()
    )
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "companies: insert by authenticated user" ON "companies";
--> statement-breakpoint
CREATE POLICY "companies: insert by authenticated user" ON "companies" FOR INSERT
  WITH CHECK (current_setting('request.jwt.claim.sub', true) IS NOT NULL);
--> statement-breakpoint
DROP POLICY IF EXISTS "companies: update by owner" ON "companies";
--> statement-breakpoint
CREATE POLICY "companies: update by owner" ON "companies" FOR UPDATE
  USING (owner_profile_id = auth_profile_id())
  WITH CHECK (owner_profile_id = auth_profile_id());
--> statement-breakpoint

-- ─── annual_report_projects ───────────────────────────────────────────
ALTER TABLE "annual_report_projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "projects: read via project_access" ON "annual_report_projects";
--> statement-breakpoint
CREATE POLICY "projects: read via project_access" ON "annual_report_projects" FOR SELECT
  USING (
    id IN (SELECT project_id FROM project_access WHERE profile_id = auth_profile_id())
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "projects: insert by authenticated user" ON "annual_report_projects";
--> statement-breakpoint
CREATE POLICY "projects: insert by authenticated user" ON "annual_report_projects" FOR INSERT
  WITH CHECK (current_setting('request.jwt.claim.sub', true) IS NOT NULL);
--> statement-breakpoint
DROP POLICY IF EXISTS "projects: update by owner role" ON "annual_report_projects";
--> statement-breakpoint
CREATE POLICY "projects: update by owner role" ON "annual_report_projects" FOR UPDATE
  USING (
    id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "projects: delete by owner role" ON "annual_report_projects";
--> statement-breakpoint
CREATE POLICY "projects: delete by owner role" ON "annual_report_projects" FOR DELETE
  USING (
    id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );
--> statement-breakpoint

-- ─── project_access ───────────────────────────────────────────────────
ALTER TABLE "project_access" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "project_access: read own row" ON "project_access";
--> statement-breakpoint
CREATE POLICY "project_access: read own row" ON "project_access" FOR SELECT
  USING (profile_id = auth_profile_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "project_access: read as owner" ON "project_access";
--> statement-breakpoint
CREATE POLICY "project_access: read as owner" ON "project_access" FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "project_access: insert by owner" ON "project_access";
--> statement-breakpoint
CREATE POLICY "project_access: insert by owner" ON "project_access" FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "project_access: delete by owner" ON "project_access";
--> statement-breakpoint
CREATE POLICY "project_access: delete by owner" ON "project_access" FOR DELETE
  USING (
    project_id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );
--> statement-breakpoint

-- ─── project_entitlements (read-only via RLS; service role writes) ────
ALTER TABLE "project_entitlements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "entitlements: read own" ON "project_entitlements";
--> statement-breakpoint
CREATE POLICY "entitlements: read own" ON "project_entitlements" FOR SELECT
  USING (profile_id = auth_profile_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "entitlements: read for accessible projects" ON "project_entitlements";
--> statement-breakpoint
CREATE POLICY "entitlements: read for accessible projects" ON "project_entitlements" FOR SELECT
  USING (
    project_id IN (SELECT project_id FROM project_access WHERE profile_id = auth_profile_id())
  );
--> statement-breakpoint

-- ─── audit_events (read-only via RLS) ─────────────────────────────────
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "audit_events: read for accessible projects" ON "audit_events";
--> statement-breakpoint
CREATE POLICY "audit_events: read for accessible projects" ON "audit_events" FOR SELECT
  USING (
    project_id IN (SELECT project_id FROM project_access WHERE profile_id = auth_profile_id())
    OR project_id IS NULL
  );
--> statement-breakpoint

-- ─── project_snapshots (read-only via RLS) ────────────────────────────
ALTER TABLE "project_snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "project_snapshots: read for accessible projects" ON "project_snapshots";
--> statement-breakpoint
CREATE POLICY "project_snapshots: read for accessible projects" ON "project_snapshots" FOR SELECT
  USING (
    project_id IN (SELECT project_id FROM project_access WHERE profile_id = auth_profile_id())
  );
--> statement-breakpoint

-- ─── project_files ────────────────────────────────────────────────────
ALTER TABLE "project_files" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "project_files: read for accessible projects" ON "project_files";
--> statement-breakpoint
CREATE POLICY "project_files: read for accessible projects" ON "project_files" FOR SELECT
  USING (
    project_id IN (SELECT project_id FROM project_access WHERE profile_id = auth_profile_id())
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "project_files: insert by accountant or owner" ON "project_files";
--> statement-breakpoint
CREATE POLICY "project_files: insert by accountant or owner" ON "project_files" FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role IN ('accountant', 'owner')
    )
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "project_files: update upload_status by uploader or owner" ON "project_files";
--> statement-breakpoint
CREATE POLICY "project_files: update upload_status by uploader or owner" ON "project_files" FOR UPDATE
  USING (
    uploaded_by_profile_id = auth_profile_id()
    OR project_id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "project_files: delete by owner" ON "project_files";
--> statement-breakpoint
CREATE POLICY "project_files: delete by owner" ON "project_files" FOR DELETE
  USING (
    project_id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );
--> statement-breakpoint

-- ─── export_files ─────────────────────────────────────────────────────
ALTER TABLE "export_files" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "export_files: read for accessible projects" ON "export_files";
--> statement-breakpoint
CREATE POLICY "export_files: read for accessible projects" ON "export_files" FOR SELECT
  USING (
    project_id IN (SELECT project_id FROM project_access WHERE profile_id = auth_profile_id())
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "export_files: delete by owner" ON "export_files";
--> statement-breakpoint
CREATE POLICY "export_files: delete by owner" ON "export_files" FOR DELETE
  USING (
    project_id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );
--> statement-breakpoint

-- ─── reports (legacy Phase 1 table) ───────────────────────────────────
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "reports: read for accessible companies" ON "reports";
--> statement-breakpoint
CREATE POLICY "reports: read for accessible companies" ON "reports" FOR SELECT
  USING (
    company_id IN (
      SELECT c.id FROM companies c
      INNER JOIN annual_report_projects arp ON arp.company_id = c.id
      INNER JOIN project_access pa ON pa.project_id = arp.id
      WHERE pa.profile_id = auth_profile_id()
    )
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "reports: insert by authenticated user" ON "reports";
--> statement-breakpoint
CREATE POLICY "reports: insert by authenticated user" ON "reports" FOR INSERT
  WITH CHECK (current_setting('request.jwt.claim.sub', true) IS NOT NULL);
--> statement-breakpoint
DROP POLICY IF EXISTS "reports: update by owner" ON "reports";
--> statement-breakpoint
CREATE POLICY "reports: update by owner" ON "reports" FOR UPDATE
  USING (
    company_id IN (
      SELECT c.id FROM companies c
      INNER JOIN annual_report_projects arp ON arp.company_id = c.id
      INNER JOIN project_access pa ON pa.project_id = arp.id
      WHERE pa.profile_id = auth_profile_id() AND pa.role = 'owner'
    )
  );
