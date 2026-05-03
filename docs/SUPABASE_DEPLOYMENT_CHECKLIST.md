# Supabase RLS Deployment Checklist

> **Purpose:** Prevent the failure mode where Row Level Security (RLS) is
> documented in `docs/rls-policies.sql` but not actually applied to the live
> Supabase project. The SQL file is **not** automatically executed by any
> deploy step. A human must run it.
>
> **Scope:** This checklist covers Supabase configuration only. Application
> code, auth middleware, and the admin gate are documented separately in
> `docs/SECURITY_ADMIN.md` and `docs/backend-security-notes.md`. Do not use
> this checklist as a substitute for reading those.

Until every item below is checked, the production app must be considered
**unsafe to publish** even if `pnpm run typecheck` and end-to-end tests
pass. Application-layer checks (the `requireAuth` / `requireSiteAdmin`
middlewares) are the second line of defence; Supabase RLS + column grants
are the first.

---

## 1. Apply the RLS policies

The canonical SQL file is **`docs/rls-policies.sql`**. There is no
migration runner for it — Drizzle handles schema only. RLS is applied
manually.

Steps:

1. Make sure the Drizzle schema has been pushed to the target Supabase
   project first. RLS policies reference table and column names; if a
   table is missing the SQL will fail.
   ```bash
   pnpm --filter @workspace/db run db:push
   ```
2. Open the Supabase dashboard for the **target environment** (staging or
   production — confirm the project ref in the URL before pasting).
3. Navigate to **SQL Editor → New query**.
4. Copy the **entire** contents of `docs/rls-policies.sql` and paste it
   into the editor.
5. Click **Run**. The script is idempotent for `CREATE POLICY` statements
   only insofar as Postgres will error if a policy with the same name
   already exists — re-running on a project that already has the
   policies will surface `policy "…" for table "…" already exists`. That
   is expected; either drop the existing policies first or skip
   re-running.
6. Run the verification queries in
   `docs/rls-verify.sql` (see section 3 below) and confirm every row
   returns the expected value.

---

## 2. Tables that MUST have RLS enabled

If `rowsecurity = false` for any of these in `pg_tables`, the deploy is
not safe.

- `profiles`
- `user_preferences`
- `companies`
- `annual_report_projects`
- `project_access`
- `project_entitlements`
- `audit_events`
- `project_snapshots`
- `project_files`
- `export_files`
- `reports`
- `annual_report_reclassification_suggestions`
- `annual_report_reclassifications`
- `annual_report_reclassification_audit_log`

Tables that are written **only** by the API server using the service-role
key (e.g. BAS mapping reference tables, internal job queues) should
either have RLS enabled with a default-deny posture (no policies) or
have `INSERT/UPDATE/DELETE` revoked from `authenticated` and `anon`.
Document any new such table here when you add it.

---

## 3. Client-write privileges that MUST be revoked

The following must be revoked from both `authenticated` and `anon`:

| Table                    | Operations to revoke              |
| ------------------------ | --------------------------------- |
| `profiles`               | `INSERT`, `DELETE`, table-wide `UPDATE` |
| `project_entitlements`   | `INSERT`, `UPDATE`, `DELETE`      |
| `audit_events`           | `INSERT`, `UPDATE`, `DELETE`      |
| `project_snapshots`      | `INSERT`, `UPDATE`, `DELETE`      |
| `export_files`           | `INSERT`, `UPDATE` (DELETE only via owner RLS) |
| `annual_report_reclassification_audit_log` | `INSERT`, `UPDATE`, `DELETE` |

Service-role connections bypass these grants — the API server is
unaffected.

---

## 4. Expected `profiles` grants

After applying `docs/rls-policies.sql`, the `authenticated` role must
have **only** the following on `profiles`:

- `SELECT` (table-wide; row visibility is controlled by the
  `profiles: own row read` policy).
- `UPDATE` on the columns: `display_name`, `default_ui_language`,
  `updated_at`. Nothing else.
- **No** `INSERT`, **no** `DELETE`, **no** table-wide `UPDATE`.

The `anon` role must have **no** write privileges on `profiles` at all.
`SELECT` may be present from the Supabase default; the
`profiles: own row read` policy ensures `anon` cannot actually read any
row because `auth.uid()` is null.

Sensitive columns that must NOT be in any `GRANT UPDATE` on `profiles`:

- `is_admin`
- `status`
- `role`
- `available_project_credits`
- `last_sign_in_at`
- `email`
- `auth_id`
- `id`, `created_at`

If any of these appear in `information_schema.column_privileges` for
`authenticated` or `anon` with `privilege_type = 'UPDATE'`, the deploy
is not safe.

---

## 5. Storage buckets

The application uses Supabase Storage for SIE imports, generated
exports, and demo assets. See `docs/supabase-storage-setup.md` and
`docs/storage-buckets.md` for the bucket inventory.

Required posture for production:

- No bucket may have `public = true` for write. Read-public is
  acceptable only for the demo-asset bucket if it intentionally serves
  static files; everything else must be private.
- Object-level policies for `imports/*` and `exports/*` must restrict
  `INSERT` / `UPDATE` / `DELETE` to the service-role connection (the
  API server signs upload URLs). The browser must not be able to
  PUT directly without a signed URL.
- Verify in **Storage → Policies** that no bucket has an "Allow all"
  policy on `INSERT`/`UPDATE`/`DELETE` for `authenticated` or `anon`.

---

## 6. After applying

1. Restart the API server so the `RLS_POLICIES_APPLIED=true` warning
   gate (see `artifacts/api-server/src/index.ts`) clears. Set the env
   var in Replit Secrets for the production deployment **only after**
   all of the above is verified.
2. Run the manual security tests in
   `docs/SECURITY_TEST_CHECKLIST.md` against the live Supabase project
   using a normal (non-admin) test account.
3. Re-run `pnpm run typecheck` to confirm nothing in the repo regressed
   while the SQL was being prepared.

---

## 7. When to re-run this checklist

- Any change to `docs/rls-policies.sql`.
- Any new table added under `lib/db/src/schema/` that holds user data.
- Any new admin route, entitlement type, or storage bucket.
- Migration of the Supabase project to a new region or project ref.
- Restoring from a backup (RLS state is restored, but column grants on
  newly-created columns from a subsequent migration are not).

If you skip a section because it is not applicable, leave a note in the
deploy ticket explaining why. Do not silently uncheck it.
