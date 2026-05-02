-- Phase 6.5 — Apply Row Level Security to the reclassification tables.
--
-- Mirrors the documented policies in docs/rls-policies.sql so RLS is
-- enforced wherever migrations are the source of truth (Supabase,
-- preview environments, prod). All three tables share the same access
-- pattern: a row is visible / writable to anyone who has access to the
-- underlying annual_report_projects via project_access. The audit log
-- is read-only via RLS; only the service role writes to it.
--
-- Note: `auth_profile_id()` is the project-wide helper installed in the
-- companion 0001 migration; it returns the profile id for the
-- authenticated supabase user.

ALTER TABLE "annual_report_reclassification_suggestions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ar_recl_suggestions: read for accessible projects"
  ON "annual_report_reclassification_suggestions" FOR SELECT
  USING (
    report_id IN (
      SELECT r.id FROM reports r
      INNER JOIN annual_report_projects arp ON arp.company_id = r.company_id
      INNER JOIN project_access pa ON pa.project_id = arp.id
      WHERE pa.profile_id = auth_profile_id()
    )
  );
--> statement-breakpoint
CREATE POLICY "ar_recl_suggestions: insert by accountant or owner"
  ON "annual_report_reclassification_suggestions" FOR INSERT
  WITH CHECK (
    report_id IN (
      SELECT r.id FROM reports r
      INNER JOIN annual_report_projects arp ON arp.company_id = r.company_id
      INNER JOIN project_access pa ON pa.project_id = arp.id
      WHERE pa.profile_id = auth_profile_id()
        AND pa.role IN ('owner', 'accountant')
    )
  );
--> statement-breakpoint
CREATE POLICY "ar_recl_suggestions: update by accountant or owner"
  ON "annual_report_reclassification_suggestions" FOR UPDATE
  USING (
    report_id IN (
      SELECT r.id FROM reports r
      INNER JOIN annual_report_projects arp ON arp.company_id = r.company_id
      INNER JOIN project_access pa ON pa.project_id = arp.id
      WHERE pa.profile_id = auth_profile_id()
        AND pa.role IN ('owner', 'accountant')
    )
  );
--> statement-breakpoint
ALTER TABLE "annual_report_reclassifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ar_recl: read for accessible projects"
  ON "annual_report_reclassifications" FOR SELECT
  USING (
    report_id IN (
      SELECT r.id FROM reports r
      INNER JOIN annual_report_projects arp ON arp.company_id = r.company_id
      INNER JOIN project_access pa ON pa.project_id = arp.id
      WHERE pa.profile_id = auth_profile_id()
    )
  );
--> statement-breakpoint
CREATE POLICY "ar_recl: insert by accountant or owner"
  ON "annual_report_reclassifications" FOR INSERT
  WITH CHECK (
    report_id IN (
      SELECT r.id FROM reports r
      INNER JOIN annual_report_projects arp ON arp.company_id = r.company_id
      INNER JOIN project_access pa ON pa.project_id = arp.id
      WHERE pa.profile_id = auth_profile_id()
        AND pa.role IN ('owner', 'accountant')
    )
  );
--> statement-breakpoint
CREATE POLICY "ar_recl: update by accountant or owner"
  ON "annual_report_reclassifications" FOR UPDATE
  USING (
    report_id IN (
      SELECT r.id FROM reports r
      INNER JOIN annual_report_projects arp ON arp.company_id = r.company_id
      INNER JOIN project_access pa ON pa.project_id = arp.id
      WHERE pa.profile_id = auth_profile_id()
        AND pa.role IN ('owner', 'accountant')
    )
  );
--> statement-breakpoint
ALTER TABLE "annual_report_reclassification_audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ar_recl_audit: read for accessible projects"
  ON "annual_report_reclassification_audit_log" FOR SELECT
  USING (
    report_id IN (
      SELECT r.id FROM reports r
      INNER JOIN annual_report_projects arp ON arp.company_id = r.company_id
      INNER JOIN project_access pa ON pa.project_id = arp.id
      WHERE pa.profile_id = auth_profile_id()
    )
  );
-- INSERT for the audit log is intentionally NOT exposed via RLS — all
-- audit rows must be written by the service role through the API layer
-- so we never trust client-supplied actor / event data.
