-- =============================================================================
-- Row Level Security (RLS) Policies — Årsredovisningar
-- =============================================================================
--
-- STATUS: Ready to apply. Paste into the Supabase SQL editor once Supabase is
-- configured and the schema has been pushed via Drizzle migrations.
--
-- APPLY ORDER: Run this file after the Drizzle schema migration is applied.
-- All tables must exist before RLS can be enabled on them.
--
-- IMPORTANT:
--   - auth.uid() returns the Supabase Auth UUID (maps to profiles.auth_id)
--   - The service role key bypasses ALL RLS policies. Use it only server-side.
--   - Never expose SUPABASE_SERVICE_ROLE_KEY in client/browser code.
--   - RLS is disabled by default on all tables — you must enable it explicitly.
--
-- HELPER FUNCTION: The policies below use a helper function to resolve the
-- internal profile UUID from the Supabase Auth UID. Create this first:
-- =============================================================================

CREATE OR REPLACE FUNCTION auth_profile_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT id FROM profiles WHERE auth_id = auth.uid()::text LIMIT 1;
$$;

-- =============================================================================
-- profiles
-- =============================================================================
-- Users can read and write only their own profile row.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own row read"
  ON profiles FOR SELECT
  USING (auth_id = auth.uid()::text);

CREATE POLICY "profiles: own row insert"
  ON profiles FOR INSERT
  WITH CHECK (auth_id = auth.uid()::text);

CREATE POLICY "profiles: own row update"
  ON profiles FOR UPDATE
  USING (auth_id = auth.uid()::text)
  WITH CHECK (auth_id = auth.uid()::text);

-- =============================================================================
-- user_preferences
-- =============================================================================
-- Linked to profiles via profile_id. Users can only access their own row.

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences: own row read"
  ON user_preferences FOR SELECT
  USING (profile_id = auth_profile_id());

CREATE POLICY "user_preferences: own row insert"
  ON user_preferences FOR INSERT
  WITH CHECK (profile_id = auth_profile_id());

CREATE POLICY "user_preferences: own row update"
  ON user_preferences FOR UPDATE
  USING (profile_id = auth_profile_id())
  WITH CHECK (profile_id = auth_profile_id());

-- =============================================================================
-- companies
-- =============================================================================
-- Users can only see companies they have access to via project_access.
-- (A company is visible if the user has access to at least one project under it.)

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies: read via project access"
  ON companies FOR SELECT
  USING (
    id IN (
      SELECT arp.company_id
      FROM annual_report_projects arp
      INNER JOIN project_access pa ON pa.project_id = arp.id
      WHERE pa.profile_id = auth_profile_id()
    )
  );

CREATE POLICY "companies: insert by authenticated user"
  ON companies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "companies: update by owner"
  ON companies FOR UPDATE
  USING (owner_profile_id = auth_profile_id())
  WITH CHECK (owner_profile_id = auth_profile_id());

-- =============================================================================
-- annual_report_projects
-- =============================================================================
-- Users can only access projects they appear in project_access for.

ALTER TABLE annual_report_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects: read via project_access"
  ON annual_report_projects FOR SELECT
  USING (
    id IN (
      SELECT project_id FROM project_access WHERE profile_id = auth_profile_id()
    )
  );

CREATE POLICY "projects: insert by authenticated user"
  ON annual_report_projects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only owners can update project metadata.
CREATE POLICY "projects: update by owner role"
  ON annual_report_projects FOR UPDATE
  USING (
    id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );

-- Only owners can archive/delete projects.
CREATE POLICY "projects: delete by owner role"
  ON annual_report_projects FOR DELETE
  USING (
    id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );

-- =============================================================================
-- project_access
-- =============================================================================
-- Users can see their own access rows. Owners can see all rows for their projects.
-- Only owners can grant or revoke access.

ALTER TABLE project_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_access: read own row"
  ON project_access FOR SELECT
  USING (profile_id = auth_profile_id());

CREATE POLICY "project_access: read as owner"
  ON project_access FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );

CREATE POLICY "project_access: insert by owner"
  ON project_access FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );

CREATE POLICY "project_access: delete by owner"
  ON project_access FOR DELETE
  USING (
    project_id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );

-- =============================================================================
-- project_entitlements
-- =============================================================================
-- Users can read their own entitlements. Only service role can write.
-- (Entitlements are created by the Stripe webhook handler using the service role key.)

ALTER TABLE project_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entitlements: read own"
  ON project_entitlements FOR SELECT
  USING (profile_id = auth_profile_id());

CREATE POLICY "entitlements: read for accessible projects"
  ON project_entitlements FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_access WHERE profile_id = auth_profile_id()
    )
  );

-- INSERT / UPDATE / DELETE: service role only (no policy = denied for anon/auth roles)

-- =============================================================================
-- audit_events
-- =============================================================================
-- Users can read audit events for projects they have access to.
-- INSERT: service role only (append-only — never updated or deleted via RLS).

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_events: read for accessible projects"
  ON audit_events FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_access WHERE profile_id = auth_profile_id()
    )
    OR project_id IS NULL  -- allow reading user-level events (no project)
  );

-- INSERT / UPDATE / DELETE: service role only.

-- =============================================================================
-- project_snapshots
-- =============================================================================
-- Users can read snapshots for projects they have access to.
-- Written by service role only.

ALTER TABLE project_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_snapshots: read for accessible projects"
  ON project_snapshots FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_access WHERE profile_id = auth_profile_id()
    )
  );

-- INSERT / UPDATE / DELETE: service role only.

-- =============================================================================
-- project_files
-- =============================================================================
-- Users with project access can read files. Accountants and owners can upload.
-- Owners can delete.

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_files: read for accessible projects"
  ON project_files FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_access WHERE profile_id = auth_profile_id()
    )
  );

CREATE POLICY "project_files: insert by accountant or owner"
  ON project_files FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role IN ('accountant', 'owner')
    )
  );

CREATE POLICY "project_files: update upload_status by uploader or owner"
  ON project_files FOR UPDATE
  USING (
    uploaded_by_profile_id = auth_profile_id()
    OR project_id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );

CREATE POLICY "project_files: delete by owner"
  ON project_files FOR DELETE
  USING (
    project_id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );

-- =============================================================================
-- export_files
-- =============================================================================
-- Users with project access can read exports. Written by service role (export service).
-- Owners can delete.

ALTER TABLE export_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "export_files: read for accessible projects"
  ON export_files FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_access WHERE profile_id = auth_profile_id()
    )
  );

CREATE POLICY "export_files: delete by owner"
  ON export_files FOR DELETE
  USING (
    project_id IN (
      SELECT project_id FROM project_access
      WHERE profile_id = auth_profile_id() AND role = 'owner'
    )
  );

-- INSERT / UPDATE: service role only (export service writes via service role key).

-- =============================================================================
-- reports (legacy Phase 1 table)
-- =============================================================================
-- Simple: users only see reports for companies they own.

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports: read for accessible companies"
  ON reports FOR SELECT
  USING (
    company_id IN (
      SELECT c.id FROM companies c
      INNER JOIN annual_report_projects arp ON arp.company_id = c.id
      INNER JOIN project_access pa ON pa.project_id = arp.id
      WHERE pa.profile_id = auth_profile_id()
    )
  );

CREATE POLICY "reports: insert by authenticated user"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "reports: update by owner"
  ON reports FOR UPDATE
  USING (
    company_id IN (
      SELECT c.id FROM companies c
      INNER JOIN annual_report_projects arp ON arp.company_id = c.id
      INNER JOIN project_access pa ON pa.project_id = arp.id
      WHERE pa.profile_id = auth_profile_id() AND pa.role = 'owner'
    )
  );
