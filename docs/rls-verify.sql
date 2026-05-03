-- =============================================================================
-- Supabase RLS / Grant Verification Queries — Årsredovisningar
-- =============================================================================
--
-- PURPOSE
--   Run these queries against the target Supabase project AFTER applying
--   docs/rls-policies.sql. Each query has an "expected result" comment.
--   Any deviation means the production deployment is not safe.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → New query → paste a section → Run.
--   Run section by section so the expected results are easy to compare.
--
-- These queries are READ-ONLY. They do not modify any policy or grant.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. RLS is enabled on every security-sensitive table
-- -----------------------------------------------------------------------------
-- Expected: every row below has rowsecurity = true.
-- If any row is missing OR rowsecurity = false → STOP, deploy is not safe.

SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'user_preferences',
    'companies',
    'annual_report_projects',
    'project_access',
    'project_entitlements',
    'audit_events',
    'project_snapshots',
    'project_files',
    'export_files',
    'reports',
    'annual_report_reclassification_suggestions',
    'annual_report_reclassifications',
    'annual_report_reclassification_audit_log'
  )
ORDER BY tablename;


-- -----------------------------------------------------------------------------
-- 2. profiles: no general UPDATE grant for authenticated or anon
-- -----------------------------------------------------------------------------
-- Expected: ONLY column-level UPDATE grants for authenticated on
--   display_name, default_ui_language, updated_at.
-- Anything else (especially is_admin, status, role,
-- available_project_credits, last_sign_in_at, email, auth_id) → STOP.
-- anon should appear with NO UPDATE rows at all.

SELECT
  grantee,
  table_name,
  column_name,
  privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND privilege_type = 'UPDATE'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, column_name;


-- -----------------------------------------------------------------------------
-- 3. profiles: no INSERT or DELETE for authenticated or anon
-- -----------------------------------------------------------------------------
-- Expected: zero rows. If any row is returned, REVOKE it before deploying.

SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND privilege_type IN ('INSERT', 'DELETE')
  AND grantee IN ('authenticated', 'anon');


-- -----------------------------------------------------------------------------
-- 4. Service-role-only tables: no client write grants
-- -----------------------------------------------------------------------------
-- Expected: zero rows. These tables are written exclusively by the API
-- server's service-role connection (or, for export_files DELETE, by the
-- owner RLS policy which is fine because DELETE is excluded below).

SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('authenticated', 'anon')
  AND (
    (table_name = 'project_entitlements' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE'))
    OR (table_name = 'audit_events' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE'))
    OR (table_name = 'project_snapshots' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE'))
    OR (table_name = 'export_files' AND privilege_type IN ('INSERT', 'UPDATE'))
    OR (table_name = 'annual_report_reclassification_audit_log' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE'))
  )
ORDER BY table_name, privilege_type;


-- -----------------------------------------------------------------------------
-- 5. Required RLS policies exist
-- -----------------------------------------------------------------------------
-- Expected: at least one policy per (table, command) listed below. Use
-- this as a smoke check; the exact policy names are documented in
-- docs/rls-policies.sql.

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;


-- -----------------------------------------------------------------------------
-- 6. profiles: only the narrow row-level UPDATE policy exists
-- -----------------------------------------------------------------------------
-- Expected: exactly one UPDATE policy on profiles, named
--   "profiles: own row update (whitelisted columns)"
-- with both qual and with_check restricting to (auth_id = auth.uid()::text).
-- If any policy here uses qual = 'true' or 'auth.uid() IS NOT NULL', STOP.
--
-- NOTE: RLS policies do not restrict which COLUMNS can be written — that
-- is enforced by the GRANT UPDATE (display_name, default_ui_language,
-- updated_at) checked in section 2 above. This section only verifies the
-- row-level scope.

SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
  AND cmd = 'UPDATE';


-- -----------------------------------------------------------------------------
-- 7. profiles: no DELETE policy at all
-- -----------------------------------------------------------------------------
-- Expected: zero rows. Profile deletion goes through the service role.

SELECT
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
  AND cmd = 'DELETE';


-- -----------------------------------------------------------------------------
-- 8. auth_profile_id() helper exists
-- -----------------------------------------------------------------------------
-- Expected: exactly one row. The function must exist or every other
-- policy that uses it is effectively broken (it would return NULL and
-- silently deny all access).
--
-- prosecdef is expected to be FALSE — docs/rls-policies.sql defines the
-- helper without SECURITY DEFINER, which is intentional: it should run
-- with the caller's privileges so the embedded SELECT on profiles is
-- itself subject to RLS. If prosecdef = true here, someone has altered
-- the helper and the access model has changed; investigate before
-- deploying.

SELECT
  proname,
  pronargs,
  prosecdef,
  prosrc
FROM pg_proc
WHERE proname = 'auth_profile_id';


-- -----------------------------------------------------------------------------
-- 9. Storage buckets: nothing publicly writable
-- -----------------------------------------------------------------------------
-- Expected: zero rows. Public-read is OK for demo assets if intentional;
-- public-write is never OK in production.
--
-- Supabase exposes bucket metadata in storage.buckets. The "public"
-- column controls anonymous read; write access is governed by storage
-- policies in storage.objects. Run BOTH queries.

SELECT id, name, public
FROM storage.buckets
WHERE public = true;

-- Storage object policies. Expected: no policy allows INSERT/UPDATE/DELETE
-- to 'anon' on any bucket, and 'authenticated' write policies should be
-- scoped (e.g. by owner or by signed URL flow), never an unrestricted
-- "Allow all" policy with qual = 'true'.

SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY policyname;


-- -----------------------------------------------------------------------------
-- 10. Sanity check: search_path / definer functions
-- -----------------------------------------------------------------------------
-- Expected: auth_profile_id() is the only project-defined function in
-- the public schema (besides anything Drizzle/Supabase generated). If
-- you see unfamiliar SECURITY DEFINER functions, audit them — they
-- bypass RLS by design.

SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  p.prosecdef AS is_security_definer,
  pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;
