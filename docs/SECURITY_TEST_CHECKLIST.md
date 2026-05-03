# Manual Security Test Checklist

> **Purpose:** Verify, with a real signed-in non-admin user, that every
> hardening rule documented in `docs/SECURITY_ADMIN.md` and
> `docs/rls-policies.sql` is actually enforced by the live Supabase
> project and the deployed API server.
>
> Run this checklist:
> - Before the first production publish.
> - After any change to `docs/rls-policies.sql`.
> - After any change to admin routes or the auth middleware.
> - After restoring Supabase from a backup.

## Setup

1. Have **two** test accounts in the target Supabase project:
   - `tester-a@example.com` — ordinary user, **not** in
     `CODE_PROTECTED_EMAILS` and **not** in `BOOTSTRAP_ADMIN_EMAILS`.
   - `tester-b@example.com` — second ordinary user, used to check
     cross-tenant access.
2. Sign in as `tester-a` in the deployed app and capture the access
   token from the browser session (DevTools → Application → Local
   Storage → `sb-…-auth-token` → `access_token`). Export it as
   `TOKEN_A` for use with `curl`. Repeat for `tester-b` → `TOKEN_B`.
3. Note the Supabase URL and anon key from `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY`. Export as `SB_URL` / `SB_ANON`.
4. Note the API base URL of the deployment. Export as `API_URL`.

Every step below is **expected to FAIL** from the user's perspective
(error response or no row affected). If any step succeeds, the
deployment is not safe — stop and fix before publishing.

---

## A. Direct Supabase writes against `profiles` (RLS + column grants)

For each of the steps below, use the Supabase REST endpoint directly
with the anon key + user JWT. This bypasses the API server, so only
RLS + column grants protect us.

### A1. Updating `is_admin`

```bash
curl -i -X PATCH "$SB_URL/rest/v1/profiles?auth_id=eq.<tester-a-auth-uid>" \
  -H "apikey: $SB_ANON" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"is_admin": true}'
```

Expected: HTTP 4xx **or** HTTP 200 with `[]` (no rows updated). The
column grant on `is_admin` does not exist for `authenticated`, so
Postgres rejects the column. Either outcome is acceptable; a HTTP 200
with the row reflecting `is_admin: true` is a **failure**.

### A2. Updating `available_project_credits`

Same shape as A1, body:
```json
{"available_project_credits": 999}
```
Expected: rejected. Note: the user-facing app must continue to refer to
this entitlement as "projects", not "credits" — only the internal
column retains the legacy name.

### A3. Updating `status` or `role`

Same shape as A1, body (one at a time):
```json
{"status": "blocked"}
```
```json
{"role": "admin"}
```
Expected: rejected.

### A4. Inserting a fake profile

```bash
curl -i -X POST "$SB_URL/rest/v1/profiles" \
  -H "apikey: $SB_ANON" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"auth_id": "00000000-0000-0000-0000-000000000000", "email": "x@example.com", "is_admin": true}'
```

Expected: HTTP 4xx. `INSERT` is revoked from `authenticated`.

### A5. Deleting own profile

```bash
curl -i -X DELETE "$SB_URL/rest/v1/profiles?auth_id=eq.<tester-a-auth-uid>" \
  -H "apikey: $SB_ANON" \
  -H "Authorization: Bearer $TOKEN_A"
```

Expected: HTTP 4xx **or** HTTP 200 with no row deleted. `DELETE` is
revoked from `authenticated` and there is no row-level DELETE policy
on `profiles`. If the row actually disappears, the deployment is not
safe.

---

## B. Admin routes are not reachable as a normal user

### B1. Listing admin endpoints

```bash
curl -i "$API_URL/admin/users" \
  -H "Authorization: Bearer $TOKEN_A"
```

Expected: HTTP **404 not_found** (not 403 — the existence of `/admin`
must not be leaked).

### B2. Granting yourself an entitlement

```bash
curl -i -X POST "$API_URL/admin/projects/<any-project-id>/grant" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: HTTP 404.

### B3. Granting yourself credits

```bash
curl -i -X POST "$API_URL/admin/users/<tester-a-profile-id>/grant-credits" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"delta": 100}'
```

Expected: HTTP 404.

---

## C. Cross-tenant project access

### C1. Reading another user's project by ID

Have `tester-b` create a project (or seed one). Note its UUID as
`PROJECT_B`. Then as `tester-a`:

```bash
curl -i "$API_URL/projects/$PROJECT_B" \
  -H "Authorization: Bearer $TOKEN_A"
```

Expected: HTTP 404. The API derives access from `project_access`
joined to `req.profile!.id`, never from any client-supplied id.

### C2. Reading via Supabase REST (RLS path)

```bash
curl -i "$SB_URL/rest/v1/annual_report_projects?id=eq.$PROJECT_B" \
  -H "apikey: $SB_ANON" \
  -H "Authorization: Bearer $TOKEN_A"
```

Expected: HTTP 200 with `[]`. The RLS policy
`projects: read via project_access` filters the row out.

### C3. Reading another user's files / exports

Repeat C2 for `project_files`, `export_files`, `audit_events`,
`project_entitlements` with `project_id=eq.$PROJECT_B`. All must
return `[]`.

---

## D. Export without entitlement

As `tester-a`, on a project they own but for which no
`project_entitlements` row exists:

```bash
curl -i -X POST "$API_URL/projects/<own-project-id>/export" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"format": "pdf"}'
```

Expected: HTTP 402 / 403 / 409 (depending on the route's contract — see
`artifacts/api-server/src/routes/annualReportExport.ts`). The export
must not be produced and no `export_files` row should be created.

---

## E. Block enforcement

Have an admin set `tester-a` to `status = 'blocked'`. Then as
`tester-a` (with the same `TOKEN_A`, before it expires):

```bash
curl -i "$API_URL/me/profile" \
  -H "Authorization: Bearer $TOKEN_A"
```

Expected: HTTP **403 account_blocked**. Every authenticated request
should short-circuit, regardless of route.

---

## Reporting

For each section, record one of:

- ✅ Pass (expected failure observed)
- ❌ Fail (the action succeeded — deployment NOT safe; file an
  incident, do not publish)
- ⚠️ Skipped (with reason — e.g. "no `tester-b` project available")

Attach the recorded results to the deploy ticket alongside the output
of `docs/rls-verify.sql`.
