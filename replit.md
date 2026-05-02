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
- **Auth**: Supabase Auth (JWT-based; frontend uses `@supabase/supabase-js`, backend validates via service role key)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml` → React Query hooks + Zod schemas)
- **Build**: esbuild (CJS bundle for API server)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push-force` — push DB schema (note: interactive prompts; prefer running raw SQL migrations via executeSql for CI)

## Artifacts

| Artifact | Kind | Preview Path | Port | Purpose |
|----------|------|-------------|------|---------|
| `arsredovisningar` | React/Vite | `/arsredovisningar` | 22133 | Main frontend — companies, reports, workspace |
| `api-server` | API | `/api` | 8080 | Express 5 backend — all server routes |
| `web` | React/Vite | `/` | 22333 | Landing page / marketing |
| `mockup-sandbox` | Design | `/__mockup` | 8081 | UI prototyping only, not production |

## Auth Flow

- Unauthenticated users are redirected to `/arsredovisningar/login`
- All API routes (except `/api/healthz`) require `Authorization: Bearer <token>`
- The frontend's custom fetch mutator (`lib/api-client-react/src/custom-fetch.ts`) injects the token automatically via `setAuthTokenGetter` wired in `AuthContext`
- Backend verifies tokens using `supabaseAdmin.auth.getUser(token)` in `src/middlewares/auth.ts`
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

## Environment Variables / Secrets

| Name | Used by | Purpose |
|------|---------|---------|
| `VITE_SUPABASE_URL` | Frontend + Backend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Public anon key for Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Service role key for JWT verification |
| `SESSION_SECRET` | Backend | Express session secret |
| `DATABASE_URL` | Backend | Replit built-in PostgreSQL connection string |

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/healthz` | none | Health check |
| GET | `/api/entitlement` | required | User's access tier (Phase 2: always "paid") |
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

## Phase Status

- **Phase 0** ✅ Complete — project structure, docs
- **Phase 1** ✅ Complete — frontend shell, backend API stubs, demo data
- **Phase 1.5** ✅ Complete — Supabase Auth wired end-to-end, UX/UI design system
- **Phase 2** ✅ Complete — user-scoped data, profile auto-creation, entitlements, audit log, real projects CRUD, WorkflowProgress UI
- **Phase 2.5** ⏳ Next — SIE file import pipeline
- **Phase 3** ⏳ Pending — report generation engine
- **Phase 3.5** ⏳ Pending — PDF/Word export
- **Phase 4** ⏳ Pending — Stripe payment gating
- **Phase 5** ⏳ Pending — AI assistance

## Important Design Decisions

- **Language**: UI is SV/EN toggleable. Annual report content (notes, statements, headings) is **always Swedish** — non-negotiable for ÅRL compliance.
- **Framework**: K3 (BFNAR 2012:1) is the primary framework. K2 supported but secondary.
- **Auth**: Supabase Auth via JWT. `requireAuth` + `syncProfile` middleware chain on all protected API routes.
- **Payments**: Stripe gating deferred to Phase 4. Phase 2 entitlement always returns "paid".
- **IDs**: All DB primary keys use UUID (Supabase-compatible).
- **Audit log**: Fire-and-forget via `logAuditEvent()`. Errors are logged but never thrown.
- **DB push**: `drizzle-kit push --force` has interactive prompts — prefer raw SQL migrations via `executeSql` in CI.
- **OpenAPI fiscal year fields**: stored as plain `text` in DB (e.g. "2024-01-01"). Do NOT use `format: date` in OpenAPI spec — Orval would generate `zod.coerce.date()` causing type mismatch.
