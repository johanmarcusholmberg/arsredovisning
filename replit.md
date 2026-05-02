# Årsredovisningar

## Overview

pnpm workspace monorepo using TypeScript. A web application for preparing Swedish annual reports (årsredovisningar). Designed for Swedish accounting firms. Annual report output is always in Swedish (ÅRL compliance); UI language can be toggled Swedish/English.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 19 + Vite (wouter routing, shadcn/ui, TanStack Query, Zod v4, Tailwind v4, framer-motion)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (Replit built-in; schema in `lib/db`)
- **Auth**: Supabase Auth (JWT-based; backend validates via service role key — not yet configured, returns 503)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml` → React Query hooks + Zod schemas)
- **Build**: esbuild (CJS bundle for API server)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema to database (requires DATABASE_URL secret)
- `pnpm --filter @workspace/scripts run setup-storage-buckets` — create Supabase Storage buckets (requires Supabase env vars)

## Artifacts

| Artifact | Kind | Preview Path | Port | Purpose |
|----------|------|-------------|------|---------|
| `arsredovisningar` | React/Vite | `/arsredovisningar` | 22133 | Main frontend — companies, reports, workspace |
| `api-server` | API | `/api` | 8080 | Express 5 backend — all server routes |
| `web` | React/Vite | `/` | 22333 | Landing page / marketing |
| `mockup-sandbox` | Design | `/__mockup` | 8081 | UI prototyping only, not production |

## Auth Flow

- Unauthenticated users are redirected to `/login`
- All API routes (except `/api/healthz`) require `Authorization: Bearer <token>`
- Backend verifies tokens using `supabaseAdmin.auth.getUser(token)` in `src/middlewares/auth.ts`
- **Phase 2.5**: Auth middleware returns 503 if Supabase is not configured (graceful degradation)
- **Phase 2.5**: Profile is auto-created on first login (auth_id → profiles row)
- The frontend's custom fetch mutator (`lib/api-client-react/src/custom-fetch.ts`) injects the token automatically
- After auth, `syncProfile` middleware auto-creates a `profiles` row for new users (keyed on Supabase `auth_id`)

## Profile Sync (Phase 2)

After JWT validation, `syncProfile` middleware (in `artifacts/api-server/src/middlewares/profile.ts`):
1. Looks up an existing profile by `authId` (Supabase UID)
2. If not found, inserts a new `profiles` row
3. Sets `req.profile` for all downstream route handlers
4. All user-scoped queries use `req.profile.id` (not the Supabase auth UID directly)

## Database Schema

All tables defined in `lib/db/src/schema/`. DB is Replit built-in PostgreSQL.

| Table | Key columns |
|-------|-------------|
| `profiles` | `id`, `auth_id` (Supabase UID), `email`, `role` |
| `companies` | `id`, `org_number`, `legal_form`, `accounting_framework`, `fiscal_year_start`, `fiscal_year_end`, `created_by_profile_id` |
| `reports` | `id`, `company_id`, `status`, `completion_percent`, `sections_completed` |
| `annual_report_projects` | `id`, `company_id`, `fiscal_year_start`, `fiscal_year_end`, `status`, `created_by_profile_id` |
| `audit_events` | `id`, `event_type`, `actor_profile_id`, `company_id`, `project_id`, `payload` |
| `project_access` | `id`, `project_id`, `profile_id`, `role` |
| `project_entitlements` | `id`, `project_id`, `profile_id`, `stripe_payment_intent_id`, `status` |

**Important**: The `companies` table uses DB column names `org_number` (not `organization_number`) and `zip_code` (not `postal_code`) — this reflects Phase 1 naming that was already pushed to the DB. Drizzle TypeScript field names are `organizationNumber` and `postalCode`, mapped to the SQL column names.

## DB Column Name Mapping (companies table)

| TypeScript field | SQL column | API field |
|-----------------|-----------|-----------|
| `organizationNumber` | `org_number` | `orgNumber` |
| `postalCode` | `zip_code` | `zipCode` |
| `fiscalYearStart` | `fiscal_year_start` | `fiscalYearStart` |
| `fiscalYearEnd` | `fiscal_year_end` | `fiscalYearEnd` |
| `createdByProfileId` | `created_by_profile_id` | `createdByProfileId` |

## Environment Variables / Secrets

See `.env.example` for the full annotated list with server-only vs client-safe annotations.

| Name | Used by | Required | Purpose |
|------|---------|----------|---------|
| `PORT` | Backend | ✅ | TCP port (set by Replit workflows) |
| `DATABASE_URL` | Backend | ✅ | Replit built-in PostgreSQL connection string |
| `VITE_SUPABASE_URL` | Frontend + Backend | Supabase Auth | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase Auth | Public anon key |
| `SUPABASE_URL` | Backend | Supabase Auth + Storage | Same as VITE_SUPABASE_URL (no VITE_ prefix) |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Supabase Auth + Storage | ⚠️ NEVER expose to browser |
| `SESSION_SECRET` | Backend | Sessions | Express session secret |
| `STRIPE_SECRET_KEY` | Backend | Phase 4 | ⚠️ NEVER expose to browser |
| `STRIPE_PUBLISHABLE_KEY` | Frontend | Phase 4 | Stripe publishable key |
| `OPENAI_API_KEY` | Backend | Phase 5 | ⚠️ NEVER expose to browser |
| `EXPORT_SERVICE_URL` | Backend | Phase 7 | PDF/Word export service URL |

## Database Schema (Phase 2.5)

All tables live in Replit's built-in PostgreSQL, managed via Drizzle ORM (`lib/db/src/schema/`).

| Table | Purpose |
|-------|---------|
| `profiles` | One row per auth user (auth_id links to Supabase Auth) |
| `user_preferences` | Per-user UI settings (language, theme) |
| `companies` | Swedish legal entities (AB, HB, KB, etc.) |
| `annual_report_projects` | One per company per fiscal year |
| `project_access` | Role-based access (owner / accountant / viewer) |
| `project_entitlements` | Payment gate per project |
| `audit_events` | Append-only action log (JSONB event_data) |
| `project_snapshots` | Point-in-time JSONB snapshots |
| `project_files` | Upload metadata (SIE, PDF, etc.) |
| `export_files` | Generated export metadata (PDF, Word) |
| `reports` | Legacy Phase 1 table (kept for backward compat) |

## Backend Security Helpers (Phase 2.5)

| File | Purpose |
|------|---------|
| `artifacts/api-server/src/helpers/permissions.ts` | Named permission checkers (`canViewProject`, `canEditProject`, `canUploadFiles`, `hasPaidProjectEntitlement`, etc.) |
| `artifacts/api-server/src/helpers/auditLog.ts` | `logAuditEvent()` + `AUDIT_EVENTS` constants |
| `artifacts/api-server/src/helpers/demo.ts` | Demo project detection, storage bucket routing, watermark enforcement |

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/healthz` | none | Health check |
| GET | `/api/entitlement` | required | User's access tier (Phase 2.5: demo or paid) |
| GET | `/api/companies` | required | List user's companies |
| POST | `/api/companies` | required | Create a company |
| GET | `/api/companies/:id` | required | Get a company |
| PATCH | `/api/companies/:id` | required | Update a company |
| GET | `/api/companies/:id/reports` | required | List reports for a company |
| POST | `/api/companies/:id/reports` | required | Create a report |
| GET | `/api/reports/:id` | required | Get a report |
| PATCH | `/api/reports/:id` | required | Update report |
| GET | `/api/reports/:id/summary` | required | Report completion summary |
| GET | `/api/dashboard/summary` | required | Dashboard stats |
| GET | `/api/projects` | required | List user's projects |
| POST | `/api/projects` | required | Create a project |
| GET | `/api/projects/:id` | required | Get a project |
| POST | `/api/projects/:id/files/upload` | required | Upload file (permission + entitlement gated) |
| GET | `/api/projects/:id/files/:fid/download` | required | Get signed download URL |
| GET | `/api/projects/:id/exports/:eid/download` | required | Get signed export URL (watermark enforced) |
| POST | `/api/reports/:id/financial-statements/generate` | required | Generate income statement + balance sheet + cash flow (K2/K3) |
| GET | `/api/reports/:id/financial-statements` | required | Get all statement lines grouped by type |
| PATCH | `/api/reports/:id/financial-statements/lines/:lineId` | required | Update note reference or manual adjustment |
| GET | `/api/reports/:id/financial-statements/lines/:lineId/drilldown` | required | Get source account detail for a line |
| POST | `/api/reports/:id/financial-statements/previous-year` | required | Bulk-save previous-year comparison values |
| GET | `/api/reports/:id/report-structure` | required | Get Swedish report structure (sections + included/conditional) |
| PATCH | `/api/reports/:id/framework` | required | Change accounting framework (K2 or K3) |

## Frontend Routes (arsredovisningar)

| Route | Component | Notes |
|-------|-----------|-------|
| `/` | `Dashboard` | Overview cards |
| `/login` | `Login` | Supabase auth |
| `/register` | `Register` | Supabase auth |
| `/companies/new` | `CompanyNew` | Create a company |
| `/companies/:companyId` | `CompanyDetail` | Company detail + reports list |
| `/reports/:reportId` | `ReportWorkspace` | Report workspace with section cards |
| `/reports/:reportId/statements` | `FinancialStatements` | Financial statements (4 sub-tabs) |
| `/reports/:reportId/summary` | `ReportSummary` | Completion summary |
| `/settings` | `Settings` | User settings |

## Frontend Key Files (arsredovisningar)

- `artifacts/arsredovisningar/src/App.tsx` — routing
- `artifacts/arsredovisningar/src/contexts/AuthContext.tsx` — Supabase auth + token injection
- `artifacts/arsredovisningar/src/pages/` — Dashboard, CompanyList, CompanyNew, CompanyDetail, ReportWorkspace, ReportSummary
- `artifacts/arsredovisningar/src/components/WorkflowProgress.tsx` — 9-step workflow tracker (not-started/current/completed/needs-review/blocked)
- `artifacts/arsredovisningar/src/hooks/useEntitlement.ts` — wraps `useGetEntitlement()` hook

## Key Library Files

- `lib/api-spec/openapi.yaml` — OpenAPI 3.1 spec (source of truth for codegen)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas (do not edit)
- `lib/db/src/schema/` — Drizzle table definitions

## Documentation

All project documentation lives in `docs/`:

- `docs/backend-architecture.md` — **NEW Phase 2.5** — data model, RLS strategy, storage, permissions guide
- `docs/rls-policies.sql` — **NEW Phase 2.5** — ready-to-apply Supabase RLS policies
- `docs/storage-buckets.md` — **NEW Phase 2.5** — bucket definitions and path conventions
- `docs/build-phases.md` — recommended phase order and status
- `docs/phase-1-summary.md` — Phase 1 summary
- `docs/functionality-specification.md` — product specification
- `docs/mvp-build-blueprint.md` — MVP scope and architecture decisions
- `docs/backend-security-notes.md` — environment variable rules, RLS, API security
- `docs/replit-setup-notes.md` — setup status, secrets, Supabase/GitHub readiness

## Phase Status

- **Phase 0** ✅ Complete — structure reviewed, docs created
- **Phase 1** ✅ Complete — frontend shell, backend API, real seeded data
- **Phase 1.5** ✅ Complete — Supabase Auth wired end-to-end
- **Phase 2.5** ✅ Complete — Backend & Security Foundation (schema, RLS, permissions, audit log, file routes)
- **Phase 4 (Task #7)** ✅ Complete — Financial Statements & Report Structure (income statement, balance sheet, cash flow, K2/K3 framework selector, BRF terminology, note reference column, drilldown, report structure generator)
- **Phase 2** ⏳ Not started — paid workspace foundation
- **Phase 3** ⏳ Not started — SIE file import and account mapping
- **Phase 5 (Task #8)** ✅ Complete — Notes Module, Auto-Numbering & AI Drafting
  - `report_notes` (full schema) + `note_statement_references` join table; unique `(report_id, note_type)` constraint
  - `noteNumberingService.recalculateNoteNumbers(reportId)` — two-pass: claims `manualNumberOverride` numbers, then sequentially fills the rest; skips `not_applicable`; syncs both `note_statement_references.display_label` and `financial_statement_lines.noteReferenceText` (clears stale badges)
  - `noteRequirementEngine.suggestNotesForReport(reportId, framework)` — idempotent upsert by `noteType`, refreshes only `not_started`/`suggested` notes
  - 7 endpoints under `/reports/{reportId}/notes`: list, create, patch, delete, suggest, recalculate-numbers, accept-text, ai-draft
  - Audit events: `note_suggested`, `note_status_changed`, `note_marked_not_applicable`, `note_text_edited`, `note_text_accepted`, `note_text_ai_generated`, `note_numbering_recalculated`, `note_reference_removed`
  - AI drafting: returns `provider: "not_configured"` with Swedish instructions when `OPENAI_API_KEY` is missing; placeholder draft when key present
  - Frontend: `/reports/:reportId/notes` page with NoteCard list, requirement/status badges, "ej tillämplig" toggle, "Generera förslag" + "Omnumrera" buttons; NoteDetailDrawer with linked lines, current/prev-year values + diff, AI-draft + Save + Godkänn flow, "Why required?"/"Show calc"/Comments accordions; ReportWorkspace "Noter" section now navigates to the page
  - Compliance banner on Notes page; missing-required-text alert
- **Phase 6** ✅ Complete — Validation, Collaboration & Audit Trail
  - **DB**: `validation_runs` (counts + readiness level), `validation_dismissals` (per-issue, with optional comment + high-risk flag), `section_reviews` (one row per `(reportId, section)`), `section_comments` (threaded, resolvable), `report_collaborators` (profileId + role), `project_snapshots` (label + payload). All keyed on `reportId`. Existing `audit_events` table reused; queries match both `projectId = reportId` and `eventData->>'reportId' = reportId` so older Phase 4/5 events surface too.
  - **Engine**: `validationEngine.ts` runs deterministic rule set (balance-sheet equality within 1 SEK, large YoY swings ≥ threshold + ≥ pct, missing required notes, etc.); produces `blocking | warning | info` levels with `isHighRisk` flag and `quickLinkPath` for deep linking.
  - **Permissions**: `permissions.ts` resolves report-level role (owner via `companies.createdByProfileId`, plus `report_collaborators`); enforces edit/comment/manage tiers.
  - **Endpoints** (all under `/reports/{reportId}`):
    - `POST /validation/run`, `GET /validation/latest`, `POST /validation/dismiss`, `GET /validation/dismissals`
    - `GET/PATCH /reviews`, `GET/POST /comments`, `PATCH /comments/{id}`
    - `GET/POST /collaborators`, `DELETE /collaborators/{profileId}`
    - `GET/POST /snapshots`, `GET /audit-events?category=&limit=`
  - **Dismissal rules**: blocking issues never dismissable; high-risk requires non-empty comment; issue must exist in latest run.
  - **Frontend pages**: `ValidationView` (issue lists by severity, dismissal dialog with mandatory comment for high-risk, quick-link buttons, readiness summary), `ReviewView` (per-section status selector, threaded comments with resolve/reopen, collaborator list with invite/remove), `AuditView` (filterable activity feed, snapshot creator + history). Routes added to `App.tsx`; ReportWorkspace SECTIONS array now includes Validering, Granskning, Aktivitet cards.
  - **Wording**: validator copy avoids "garanterat / juridiskt / 100% / felfri" — frames itself as a check that "ersätter inte din egen granskning".
- **Phase 7** ⏳ Not started — PDF/Word export and download flow

## Important Design Decisions

- **Language**: UI is SV/EN toggleable. Annual report content is **always Swedish** — non-negotiable for ÅRL compliance.
- **Framework**: K3 (BFNAR 2012:1) primary; K2 deferred.
- **Auth**: Supabase Auth JWT — backend validates via service role key. Returns 503 gracefully if not configured.
- **Payments**: Stripe (Phase 4) — `project_entitlements` table ready. Demo projects always watermarked.
- **Demo separation**: `helpers/demo.ts` enforces demo → `demo-assets` bucket; never production buckets.
- **Audit log**: Append-only `audit_events` table. `logAuditEvent()` is non-throwing.
- **IDs**: All DB primary keys use UUID.
- **Security**: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `OPENAI_API_KEY` — server-only. Never prefix with `VITE_`.
- **DB push**: `drizzle-kit push --force` has interactive prompts — prefer raw SQL migrations via `executeSql` in CI.
- **OpenAPI fiscal year fields**: stored as plain `text` in DB (e.g. "2024-01-01"). Do NOT use `format: date` in OpenAPI spec — Orval would generate `zod.coerce.date()` causing type mismatch.
