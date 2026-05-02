# Backend Architecture — Årsredovisningar

## Status

Phase 2.5 complete. Supabase Auth is **not yet configured** — auth middleware is
wired but depends on `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The
database schema is live on Replit's built-in PostgreSQL via Drizzle ORM.

---

## Data Model Overview

### Table Relationships

```
profiles  ←──────────────────── user_preferences (1:1)
    │
    ├──[created_by]── companies ──[owner]── profiles
    │                     │
    │                     └── annual_report_projects
    │                               │
    │               project_access ─┤─ profiles  (many-to-many, with role)
    │                               │
    │         project_entitlements ─┤─ profiles  (payment gate)
    │                               │
    │                  project_files┤            (SIE, PDF uploads)
    │                               │
    │                  export_files ┤            (generated PDF/Word)
    │                               │
    └──[actor]── audit_events ──────┤            (append-only log)
                                    │
                 project_snapshots ─┘            (point-in-time JSONB)
```

### Table Summary

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | One per auth user | `auth_id`, `email`, `display_name`, `default_ui_language` |
| `user_preferences` | UI settings per user | `ui_language`, `theme`, `notifications_placeholder` |
| `companies` | Swedish legal entities | `organization_number`, `legal_form`, `accounting_framework` |
| `annual_report_projects` | One per fiscal year per company | `status`, `accounting_framework`, `annual_report_language` |
| `project_access` | Role-based access control | composite PK `(profile_id, project_id)`, `role` |
| `project_entitlements` | Payment/access gate | `entitlement_type`, `is_active`, `stripe_payment_intent_id` |
| `audit_events` | Append-only action log | `event_type`, `event_data` JSONB |
| `project_snapshots` | Point-in-time project state | `snapshot_data` JSONB |
| `project_files` | Upload metadata | `storage_bucket`, `storage_path`, `upload_status`, `parse_status` |
| `export_files` | Generated export metadata | `format`, `export_status`, `watermark` |
| `reports` | Legacy Phase 1 table | Superseded by `annual_report_projects` — kept for backward compatibility |

---

## RLS Strategy

All customer-facing tables have Row Level Security enabled on Supabase.
See `docs/rls-policies.sql` for the full policy definitions.

### Core principle

**Trust no client.** All permission checks happen server-side in Express
(via `artifacts/api-server/src/helpers/permissions.ts`) AND at the database
level via Supabase RLS. The dual-layer defense means a bug in the Express
layer cannot leak data — the database itself enforces access control.

### RLS policy patterns

| Table | Read | Write |
|-------|------|-------|
| `profiles` | Own row only | Own row only |
| `user_preferences` | Own row only | Own row only |
| `companies` | Via `project_access` | Owner can update |
| `annual_report_projects` | Via `project_access` | Owner can update |
| `project_access` | Own rows + project owner sees all | Owner can grant/revoke |
| `project_entitlements` | Own entitlements | Service role only |
| `audit_events` | Accessible projects | Service role only |
| `project_snapshots` | Accessible projects | Service role only |
| `project_files` | Accessible projects | Accountant/Owner |
| `export_files` | Accessible projects | Service role only |

### The `auth_profile_id()` helper function

RLS policies use `auth_profile_id()`, a stable SQL function that maps the
Supabase Auth UID (`auth.uid()`) to the internal `profiles.id` UUID. This
decouples RLS from the Supabase Auth user ID, allowing profile merges/migrates
without rewriting all policies.

---

## Storage Strategy

Five Supabase Storage buckets (see `docs/storage-buckets.md`):

| Bucket | Visibility | Used for |
|--------|-----------|---------|
| `import-files` | Private | SIE, Excel, CSV uploads |
| `previous-annual-reports` | Private | Reference PDF uploads |
| `cover-sheets` | Private | Cover sheet uploads |
| `exports` | Private | Generated PDF/Word exports |
| `demo-assets` | Public | Static demo files |

**Path convention:** `{projectId}/{fileId}/{originalFilename}` for private buckets.

All file access goes through the Express API which:
1. Verifies session authentication
2. Checks project permission via `permissions.ts`
3. Generates a time-limited signed URL via Supabase Storage client
4. Never returns the raw bucket URL or service role key to the client

---

## Permission Helpers

Location: `artifacts/api-server/src/helpers/permissions.ts`

All helpers accept a `profileId` (internal UUID from session) and return booleans.
Use them at the start of every protected route handler.

```typescript
import {
  canViewProject,     // any project role
  canEditProject,     // accountant or owner
  canManageProjectUsers, // owner only
  canUploadFiles,     // accountant or owner
  canRunValidation,   // accountant or owner
  canExportProject,   // owner only
  hasPaidProjectEntitlement, // active non-demo/non-trial entitlement
  canCreateRealProject,      // user exists (Phase 4: add Stripe check)
} from "../helpers/permissions";
```

Example:
```typescript
if (!(await canEditProject(profileId, projectId))) {
  return res.status(403).json({ error: "forbidden" });
}
```

---

## Audit Logging

Location: `artifacts/api-server/src/helpers/auditLog.ts`

`logAuditEvent(...)` is non-throwing — failures are logged but never propagate
to the calling request. Use it after every significant state-changing operation.

```typescript
import { logAuditEvent, AUDIT_EVENTS } from "../helpers/auditLog";

await logAuditEvent({
  eventType: AUDIT_EVENTS.FILE_UPLOADED,
  projectId,
  actorProfileId: profileId,
  eventData: { filename, fileSize },
});
```

Available event type constants in `AUDIT_EVENTS`:
- `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_ARCHIVED`, `PROJECT_SNAPSHOT_CREATED`
- `FILE_UPLOADED`, `FILE_DOWNLOAD_REQUESTED`
- `SIE_UPLOADED`, `SIE_PARSED`, `ACCOUNTS_MAPPED`
- `STATEMENTS_GENERATED`
- `NOTE_CREATED`, `NOTE_UPDATED`, `NOTE_DELETED`
- `VALIDATION_RUN`
- `EXPORT_GENERATED`, `EXPORT_DOWNLOADED`
- `PAYMENT_INITIATED`, `PAYMENT_COMPLETED`, `PAYMENT_FAILED`
- `USER_INVITED`, `USER_REMOVED`

---

## Demo vs Production Separation

Location: `artifacts/api-server/src/helpers/demo.ts`

Rules enforced by the backend (not just the UI):
1. Demo projects always use the `demo-assets` storage bucket.
2. All demo exports are always watermarked (`mustWatermark` returns true).
3. Demo projects cannot write to production buckets (`PRODUCTION_BUCKETS`).
4. Demo data does not count toward payment entitlements.

The `DEMO_PROJECT_ID` constant identifies the shared demo project by UUID.
Once the seed script is run, set this to the actual UUID.

---

## Entitlement and Payment Gating

`hasPaidProjectEntitlement(projectId)` checks for an active entitlement with type
`stripe_payment`, `subscription`, or `manual_grant`. Until Phase 4, entitlements
are created manually in the database for testing.

The file upload route enforces: if not demo and not paid → HTTP 402 Payment Required.
The export download route enforces: watermark = !paid || isDemo.

Phase 4 will add:
- Stripe webhook handler → creates/updates `project_entitlements` row
- `canCreateRealProject` will check for subscription or available credits

---

## Known Limitations

| Limitation | Resolution |
|-----------|-----------|
| Supabase Auth not configured | `requireAuth` middleware is wired but needs `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Until then, all protected routes return 401. |
| Supabase Storage not configured | File upload/download routes return stub signed URLs (`TODO:supabase-signed-url/...`). Real URLs need Supabase Storage client wired in. |
| Stripe not integrated | Entitlements created manually. Phase 4 adds webhook handler. |
| SIE parsing not implemented | Phase 3. Upload route stores metadata only (`upload_status: pending`). |
| Export generation not implemented | Phase 7. Export route returns stub download URL. |
| `auth_profile_id()` SQL function | Must be created in Supabase before applying RLS policies. See `docs/rls-policies.sql`. |

---

## What Future Phases Build On Top Of

- **Phase 3 (Import):** POST `/api/projects/:id/files/upload` → update `parse_status` to `processing` → parse SIE → insert account mapping rows → update to `completed`.
- **Phase 4 (Payment):** Stripe webhook → `POST /api/webhooks/stripe` → create `project_entitlements` row with `stripe_payment_intent_id`.
- **Phase 5 (Notes):** Use `note_numbering_state` JSONB in `project_files` to persist auto-numbering state machine.
- **Phase 6 (Validation):** `canRunValidation` permission already wired; add validation logic and `AUDIT_EVENTS.VALIDATION_RUN` logging.
- **Phase 7 (Export):** Use `export_files` table + `hasPaidProjectEntitlement` + `mustWatermark` — all already in place.
