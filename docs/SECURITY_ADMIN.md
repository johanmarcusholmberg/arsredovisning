# Admin Security Model

This document describes how administrative access is enforced in the
Årsredovisningar backend, what fields ordinary users can change about
themselves, and what must be re-checked if the surface area changes
(e.g. a profile-deletion endpoint is added).

## 1. How admin access is enforced

There are three independent layers. All three must hold for an admin
mutation to succeed.

1. **Supabase Auth (identity).** Every API request must carry a valid
   Bearer token. `requireAuth` in
   `artifacts/api-server/src/middlewares/auth.ts` validates it via the
   Supabase admin client and resolves the internal `profiles.id`.
2. **Server-side admin gate.** All admin endpoints are mounted under
   `/admin/*` and the very first middleware on that subtree is
   `requireSiteAdmin` in `artifacts/api-server/src/routes/admin.ts`:
   - Re-reads `profiles.is_admin` and `profiles.status` from the database
     on every call (no trust in cached claims).
   - Rejects with `404 not_found` (not 403) when the caller is not an
     active admin, so the existence of `/admin/*` is not leaked.
3. **Database write boundary.** The API server connects to Postgres via
   the **service-role** key, which bypasses RLS. Browsers and mobile
   clients only ever hold an `authenticated`-role JWT, which is bound by
   RLS policies and column-level GRANTs (see `docs/rls-policies.sql`).
   Sensitive `profiles` columns are not granted to `authenticated`, so
   the only path that can change them is the service-role-backed admin
   API.

Block enforcement: if `profiles.status = 'blocked'`, `requireAuth`
short-circuits with `403 account_blocked` for every authenticated
request, before any route handler runs.

## 2. Protected admin emails

Source of truth: `artifacts/api-server/src/lib/protectedAdmins.ts`.

The protected set is the union of:

- `CODE_PROTECTED_EMAILS` — hard-coded in the file. Always present.
  Currently: `johanmarcusholmberg@gmail.com`.
- `BOOTSTRAP_ADMIN_EMAILS` env var — comma- or whitespace-separated
  list. Optional, used to add ops/support staff without a code deploy.

Behaviour for any email in the protected set:

- **Auto-promotion.** On sign-in, `requireAuth` ensures the matching
  `profiles` row has `is_admin = true` and `status = 'active'`. If the
  row does not exist yet it is created with `is_admin = true`. If it
  exists but is demoted or blocked, it is self-healed.
- **Demotion / blocking refused.** `POST /admin/users/:id/set-admin
  {isAdmin: false}` and `POST /admin/users/:id/set-status
  {status: "blocked"}` both check `isProtectedAdminEmail(target.email)`
  and return `403 forbidden` if it matches. This makes admin lock-out
  via the UI impossible.
- **Removal requires two steps:** remove the email from
  `CODE_PROTECTED_EMAILS` *and* `BOOTSTRAP_ADMIN_EMAILS`, then either
  flip `is_admin = false` directly in the database or call the admin
  API. Otherwise the next sign-in re-promotes the user.

Comparison is case-insensitive. The set is resolved once at process
start; restart the API server after changing the env var.

## 3. Fields a normal user MAY change about themselves

Through the API (`PATCH /me/profile`, validated by
`UpdateMyProfileBody`):

- `displayName`
- `defaultUiLanguage` (`"sv"` | `"en"`)

Through the API (`PATCH /me/preferences`, validated by
`UpdateMyPreferencesBody`, writes to `user_preferences`):

- `emailWeeklySummary`
- `deadlineAlertsEnabled`

Through Supabase Auth (server proxies via `/me/password`, `/me/email`):

- Password (current password is re-verified before the change).
- Email (the resulting change is mirrored into `profiles.email` by
  `syncProfile` after Supabase confirms it).

Through direct Supabase JS client calls against `profiles` (allowed by
RLS + column-level `GRANT UPDATE` in `docs/rls-policies.sql`):

- `display_name`
- `default_ui_language`
- `updated_at`

Anything else is rejected by Postgres at the column-grant level even
if the user crafts a raw `update` against the table. Direct client
`INSERT` and `DELETE` on `profiles` are also revoked entirely — the
auth middleware (service role) is the sole creator of profile rows.

## 4. Fields that are admin / backend-only

These columns on `profiles` cannot be written by any browser or mobile
client. They are writable only via the API server's service-role
connection, and only through specific endpoints:

| Column                       | Writable by                                                        |
| ---------------------------- | ------------------------------------------------------------------ |
| `is_admin`                   | `POST /admin/users/:id/set-admin` (admin only) + auth self-heal    |
| `status`                     | `POST /admin/users/:id/set-status` (admin only) + auth self-heal   |
| `role`                       | Set on profile creation only (auth middleware / `syncProfile`)     |
| `available_project_credits`  | `POST /admin/users/:id/grant-credits` (admin) + project-create txn |
| `last_sign_in_at`            | Auth middleware, throttled to once per minute                      |
| `email`                      | `syncProfile` after Supabase Auth confirms an email change         |
| `auth_id`                    | Profile creation only                                              |
| `id`, `created_at`           | Database default; never updated                                    |

Other admin-only mutations (different tables but same gate):

- `project_entitlements`: write is service-role only at the RLS level;
  all UI-driven writes go through `POST /admin/projects/:id/grant` and
  `POST /admin/projects/:id/revoke`.
- `audit_events`: append-only at the RLS level; only the API server
  inserts via `logAuditEvent`.

## 5. Audit logging

Source: `artifacts/api-server/src/lib/auditLog.ts`. Schema:
`lib/db/src/schema/auditEvents.ts`. Read endpoint:
`GET /admin/audit?limit=…` (capped at 500 rows, joined with actor
email).

Properties:

- **Append-only.** RLS allows `SELECT` for users with project access
  (or `project_id IS NULL` for user-level events). `INSERT` / `UPDATE`
  / `DELETE` are service-role only — there is no public write path.
- **Fire-and-forget.** Failures are logged via the request logger but
  never thrown, so an audit-write outage does not block the user
  action. Critical actions should still be safe because the underlying
  mutation is wrapped in the same handler.
- **Required fields per admin mutation.** Every admin write in
  `routes/admin.ts` calls `logAuditEvent` with at least:
  - `eventType` (e.g. `admin.role_changed`, `admin.status_changed`,
    `admin.credits_adjusted`, `admin.entitlement_granted`,
    `admin.entitlement_revoked`)
  - `actorProfileId = req.profile!.id`
  - a payload with the target id and the before/after values where
    applicable.

When you add a new admin endpoint, you MUST emit an audit event with
the actor, the target, and the change. Code review should reject any
admin mutation without one.

## 6. Checklist for a future profile-deletion endpoint

If `DELETE /admin/users/:profileId` (or any equivalent) is added,
verify each of the following before merging:

1. **Mounted under `/admin/*`** so `requireSiteAdmin` runs first.
2. **Protected-admin guard.** Reject with `403` when
   `isProtectedAdminEmail(target.email)` is true. The bootstrap admin
   must never be deletable from the UI, including the caller themself.
3. **Self-deletion guard.** Reject when `targetId === req.profile!.id`
   (mirroring the existing self-demote / self-block guards).
4. **RLS for `profiles` `DELETE`.** The current policy file does not
   define a `FOR DELETE` policy on `profiles`, so RLS already denies
   deletes for `authenticated` and `anon`. Keep it that way: do **not**
   add a row-level delete policy. The service-role connection is the
   only allowed deleter. If a delete policy is ever added, restrict it
   so that bootstrap admins cannot be removed from the database side
   either.
5. **Foreign-key strategy.** Decide explicitly whether to:
   - hard-delete and rely on cascading FKs (verify every referencing
     table — `project_access`, `project_entitlements`, `audit_events`,
     `project_files`, `report_collaborators`, `companies.owner_profile_id`,
     `annual_report_projects.created_by_profile_id`, …),
   - **or** soft-delete by setting `status = 'deleted'` and nulling
     `auth_id` / scrubbing PII (`email`, `display_name`).
   The current preference, given the audit/legal requirements for
   accounting data, is **soft delete**. Hard deletion of a profile that
   owns a project would orphan financial data.
6. **Audit event.** Emit `admin.profile_deleted` with the actor, the
   target id, the deletion mode (soft / hard), and a snapshot of the
   relevant fields (email, was_admin, had_active_entitlements).
7. **Supabase Auth side.** Hard-deleting `profiles` does not remove
   the corresponding Supabase `auth.users` row. Either also call
   `supabase.auth.admin.deleteUser(authId)` or document that the auth
   account remains and will recreate a fresh profile on next sign-in.
8. **Tests.** Cover: ordinary user attempting the call (must `404`),
   admin deleting a non-protected user (success + audit row), admin
   trying to delete a protected admin (must `403`), admin trying to
   delete themself (must `400`), deletion of a user who owns projects
   (verify chosen strategy).

## 7. Verification commands

Run these after any change to admin code, RLS, or the profiles schema:

```bash
pnpm run typecheck                                    # full repo typecheck
pnpm --filter @workspace/db run db:check              # drift between schema and migrations
pnpm --filter @workspace/api-spec run codegen         # regenerate Zod / hooks if the spec changed
```

## 8. Production deployment

The application-layer protections in this document are the **second**
line of defence. The **first** line is Supabase RLS plus column-level
grants in `docs/rls-policies.sql`. That SQL is **not** applied
automatically by any deploy step — a human must paste it into the
Supabase SQL Editor for each environment.

Before publishing to production, complete:

1. `docs/SUPABASE_DEPLOYMENT_CHECKLIST.md` — apply the policies and
   verify table/column posture.
2. `docs/rls-verify.sql` — run the read-only verification queries in
   the Supabase SQL Editor and confirm every section returns the
   expected result.
3. `docs/SECURITY_TEST_CHECKLIST.md` — manually attempt the documented
   bypasses as a normal (non-admin) user against the live deployment.
4. Set `RLS_POLICIES_APPLIED=true` in the production Replit Secrets to
   silence the startup warning emitted by
   `artifacts/api-server/src/index.ts`.

Do **not** set `RLS_POLICIES_APPLIED=true` until all three checklists
have been completed for the target environment.
