# Årsredovisningar

## Overview

This project is a pnpm monorepo web application using TypeScript, designed for preparing Swedish annual reports (årsredovisningar). It targets Swedish accounting firms, providing a system that ensures ÅRL compliance by generating annual reports exclusively in Swedish, while offering a dual-language (Swedish/English) UI. The project aims to streamline the annual report generation process with features like financial statement generation, note management with AI drafting, validation, collaboration tools, and a comprehensive audit trail.

## User Preferences

- The UI language can be toggled between Swedish and English.
- Annual report content must always be in Swedish for ÅRL compliance.
- All primary keys in the database should use UUIDs.
- Critical environment variables (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `OPENAI_API_KEY`) must be server-only and never exposed to the browser.
- When pushing DB schema, prefer raw SQL migrations via `executeSql` in CI over `drizzle-kit push --force` due to interactive prompts.
- All schema drift between `lib/db/src/schema/*.ts` and the live Postgres database must be zero. The root `pnpm typecheck` command runs `pnpm run check-schema-drift` (script: `scripts/src/checkSchemaDrift.ts`) at the end of the pipeline and fails on any drift.
- Avoid using `format: date` in OpenAPI specifications for fiscal year fields to prevent type mismatches with generated Zod schemas.

## System Architecture

The application is built as a pnpm monorepo using Node.js 24 and TypeScript 5.9.

### UI/UX Decisions
- **Frontend**: React 19 with Vite, utilizing `wouter` for routing, `shadcn/ui` for components, `TanStack Query` for data fetching, `Zod v4` for schema validation, `Tailwind v4` for styling, and `framer-motion` for animations.
- **Language**: UI is SV/EN toggleable. Annual report output is exclusively in Swedish for compliance.
- **Workflow**: Features a 9-step workflow tracker for report progress (not-started/current/completed/needs-review/blocked).

### Technical Implementations
- **API Framework**: Express 5.
- **Monorepo Structure**: Managed with pnpm workspaces.
- **API Codegen**: Orval generates React Query hooks and Zod schemas from an OpenAPI spec (`lib/api-spec/openapi.yaml`).
- **Build System**: `esbuild` for CJS bundle of the API server.
- **Authentication**: Supabase Auth (JWT-based) with backend validation using a service role key. Unauthenticated users are redirected to `/login`, and a user profile is auto-created on first login.
- **Profile Synchronization**: A `syncProfile` middleware ensures a `profiles` row exists for every authenticated user, linking to the Supabase `auth_id`.
- **Backend Security**: Includes named permission checkers (`canViewProject`, `canEditProject`, etc.), a non-throwing audit log (`logAuditEvent()`), and helpers for demo project detection and storage bucket routing.
- **Validation Engine**: Deterministic rule set for validating annual reports, producing `blocking`, `warning`, or `info` levels with `isHighRisk` flags and `quickLinkPath` for deep linking.
- **Note Module**: Manages report notes with auto-numbering and AI drafting capabilities.
- **Collaboration**: Features section reviews, threaded comments, and role-based access for collaborators.
- **Audit Trail**: Append-only `audit_events` table for tracking actions, along with `project_snapshots` for point-in-time data captures.

### Feature Specifications
- **Core Functionality**: Create and manage companies, annual report projects, and individual reports.
- **Financial Statements**: Generation of income statements, balance sheets, and cash flow statements, supporting K2/K3 accounting frameworks. Includes drilldown capabilities and previous-year comparisons.
- **Report Structure**: Dynamic generation of Swedish report structures with sectional completion tracking.
- **File Management**: Secure upload and download of project files (e.g., SIE, PDF) with permission and entitlement gating.
- **Export**: Generation and download of PDF/Word exports with watermark enforcement for demo projects. Phase 6.6/7 introduces a single source-of-truth `AnnualReportExportData` contract (`lib/export-contract`) that powers Preview = PDF = Word, with consistency checks, readiness gating, cover-sheet settings, signed-URL downloads, audit logging, and an export history list at `/reports/:reportId/preview`.

### Auth Consolidation (post-Phase 7.5)
- **Single auth surface**: All authentication lives in `artifacts/arsredovisningar` (real Supabase Auth via `lib/supabase.ts` + `contexts/AuthContext.tsx`, secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`).
- **Marketing site** (`artifacts/web`) is now strictly marketing + demo. Routes `/login`, `/signup`, `/dashboard`, and `/workspace*` use a small `RedirectToApp` component (`window.location.replace`) to hand off to `/arsredovisningar/login`, `/arsredovisningar/register`, and `/arsredovisningar/` respectively. The header "Logga in" / "Skapa konto" buttons are plain `<a>` tags pointing at the real app — no client-side wouter routing across artifact boundaries.
- **Removed stubs**: `pages/LoginPage.tsx`, `pages/SignupPage.tsx`, `pages/DashboardPage.tsx`, `pages/PaidWorkspacePage.tsx`, `pages/workspace/`, `hooks/useAuth.ts` were all deleted from `artifacts/web` to eliminate the never-functional placeholder auth.

### Phase 7.5 — Kassaflödesanalys (Cash Flow Statement)
- **Legal-requirement assessment** at `/reports/:reportId/cash-flow` (`pages/CashFlowPage.tsx`) — assesses whether kassaflödesanalys is mandatory under ÅRL using size thresholds (50 employees / 40 MSEK balansomslutning / 80 MSEK nettoomsättning, 2 of 3 met for two consecutive years), listed-company status, and BRF flag. Centralized constants in `lib/complianceConfig.ts`.
- **Indirect-method generator** in `lib/cashFlowStatementService.ts` — builds 22 canonical lines (operating / investing / financing / reconciliation) from `financial_statement_lines`, marks placeholder lines as `needsReview` for user confirmation, supports manual line edits and audited adjustments.
- **Validation** integrated into the main `validationEngine` — emits blocking issues when CF is mandatory but missing/invalid, when reconciliation fails (1 SEK tolerance), or when calculated closing cash differs from balance-sheet cash. Surface alongside other report-readiness rules.
- **Export injection** in `exportDataBuilder.buildStatements()` — emits the cash flow as a `FinancialStatement{ type: "cash_flow" }` ONLY when both (a) the assessment indicates inclusion and (b) the statement status is `validated`. Any line edit / adjustment automatically reverts status to `needs_review` to force re-validation before re-export.
- **DB**: 5 tables (`cash_flow_requirement_assessments`, `cash_flow_statements`, `cash_flow_line_items`, `cash_flow_adjustments`, `cash_flow_account_classifications`) plus 7 enums.
- **API**: 10 endpoints under `/api/reports/:reportId/cash-flow/*`, fully audit-logged via `helpers/auditLog`.
- **Per-account source data layer** (`lib/cashFlowSourceData.ts` + `lib/cashFlowBasClassifier.ts`): derives every operating/investing/financing line from confirmed staging account balances. BAS-range default classifier seeds rows; report mapping refines them; user can override per account without touching the BS/IS mapping. `deriveFromMovements` in `cashFlowStatementService` consumes the bundle (falls back to aggregated `financial_statement_lines` when account data is unavailable). Each derived line stores its contributing source accounts (JSON in `sourceAccounts`) and a Swedish review reason for ambiguous cases (loans cannot be split between new lending and amortisation, fixed-asset rörelse cannot be split between förvärv and avyttring, etc.). UI on `CashFlowPage` exposes per-line "Visa källkonton" expansion and a `RemapAccountDialog` posting to PATCH `/cash-flow/account-classifications/:accountNumber`. Overrides regenerate the statement and downgrade `validated` → `needs_review`.
- **Workflow integration**: new "Kassaflödesanalys" workspace section + workflow step between reclassifications and validation.

### User Settings (post-Phase 8)
- **Functional Settings page** at `/settings` (`pages/Settings.tsx`) — replaces the previous static mock with a fully wired page backed by `/api/me`, `/api/me/profile`, `/api/me/preferences`, `/api/me/password`, `/api/me/email`. Routes live in `artifacts/api-server/src/routes/me.ts` and reuse `requireAuth + syncProfile`.
- **Profile fields**: editable Display Name, read-only Email (with a "Change" dialog that initiates Supabase email confirmation), Language select (`profiles.default_ui_language` — `sv` / `en`).
- **Notifications**: two real preferences `email_weekly_summary` + `deadline_alerts_enabled` on `user_preferences` (replaces the old `notifications_placeholder` column). Toggles auto-save with optimistic updates and are disabled while in flight to avoid out-of-order races.
- **Password change**: server endpoint re-verifies the current password via a transient anon Supabase client (`signInWithPassword`) before calling `admin.updateUserById`. Because the admin update revokes all existing sessions, the frontend re-issues `supabase.auth.signInWithPassword` with the new password in the mutation's `onSuccess` so the user stays logged in.
- **Email change**: `admin.updateUserById({ email })` triggers Supabase's confirmation flow. `syncProfile` middleware now re-syncs `profiles.email` whenever the JWT's email differs from the stored row, so the UI reflects the change on the next authenticated request.
- **Out of scope** (potential follow-ups): forgot-password flow on the login page, MFA enrollment, real notification delivery (preferences only persist intent today).

### Phase 8 — Launch Polish
- **Launch Checklist** at `/launch-checklist` (`pages/LaunchChecklist.tsx`) — internal/admin readiness page covering env vars, Supabase tables/RLS, auth, payment, export, AI, storage, note numbering, manual QA, and Known Limitations (Swedish-only output, K2/K3 only, no Fortnox/Visma, no Bolagsverket fetch, no multi-step approvals, no version branching, no template management).
- **Compliance wording** standardized to: *"Inga blockerande valideringsfel hittades. Granska noggrant innan inlämning. Verktyget är en complianceassistent — du som upprättare ansvarar..."* (NotesPage). The product is positioned as a compliance assistant, never a guarantee.
- **Palette tokens** in `index.css` are documented as semantic — current default is **Nordic Calm**. Future palettes (Midnight Ledger, Sand & Ink, Arctic Minimal, Nordic Night) can be applied by swapping values in `:root`/`.dark` without touching components. PDF/Word export deliberately ignores decorative tokens.
- **Responsive layout** tightened: SidebarLayout content padding now scales `p-4 sm:p-6 md:p-8 lg:p-10` so mobile browsers don't crop content.

### System Design Choices
- **Accounting Framework**: K3 (BFNAR 2012:1) is primary.
- **Demo Handling**: Dedicated `helpers/demo.ts` ensures demo projects use `demo-assets` storage buckets and apply watermarks, strictly separating them from production assets.
- **API Routes**: Comprehensive set of RESTful API endpoints covering companies, reports, projects, financial statements, notes, validation, reviews, comments, and audit events, all requiring authentication unless explicitly public.
- **Frontend Routes**: Structured routing for dashboard, login/register, company management, report workspaces, financial statements, and user settings.

## Database migrations

The Drizzle schema files in `lib/db/src/schema/*.ts` are the single source of truth for the Postgres schema. To make a schema change:

1. Edit the table file under `lib/db/src/schema/`. Re-export new tables from `lib/db/src/schema/index.ts`.
2. Apply to the dev database: `pnpm --filter @workspace/db run push --force`.
   - `--force` skips the interactive truncation prompt; only run when you've checked the affected tables yourself. For tables that already contain rows and need a new `UNIQUE` constraint, pre-add the constraint via `executeSql` so push won't prompt.
3. Optionally capture the change as a historical SQL snapshot: `pnpm --filter @workspace/db run generate -- --name=<short_change_summary>`. The files in `lib/db/drizzle/*.sql` are **archival only** — `drizzle-kit migrate` is not run in CI or at runtime. The `push` step in (2) is what actually changes the database; `--force` should only ever be used in dev, never in production.
4. Verify zero drift: `pnpm typecheck` (which runs `pnpm run check-schema-drift` at the end of the chain). The drift check compares the following between Drizzle schema and the live database (base tables only, excluding `__drizzle_migrations`):
   - Column presence, normalized type, nullability
   - Column DEFAULTs (with synonym normalization for `now()`/`current_timestamp`, `uuid_generate_v4()`/`gen_random_uuid()`, jsonb literals, and stripped type casts)
   - Enum value sets (`pg_enum`)
   - RLS state for tables documented in `lib/db/drizzle/*_rls.sql` (currently the three Phase 6.5 reclassification tables): both `pg_tables.rowsecurity` and the expected policy count must match.

   It fails the build if `DATABASE_URL` is not set unless `SKIP_SCHEMA_DRIFT_CHECK=1` is also set (intended for sandboxed local builds without a DB). Individual categories can be turned off per-run with `DRIFT_CHECK_ENUMS=0`, `DRIFT_CHECK_DEFAULTS=0`, or `DRIFT_CHECK_RLS=0`.

### Row-Level Security

The API server connects with the Supabase **service role key**, which bypasses RLS. RLS therefore only protects against direct browser/anon-role access (and against bugs that accidentally bypass the API layer). Policies for the Phase 6.5 reclassification tables live in `lib/db/drizzle/0003_phase_6_5_reclassification_rls.sql`, and their dependency `auth_profile_id()` is defined in `lib/db/drizzle/0004_phase_6_5_rls_function.sql`. To re-apply both on a fresh database, run those two SQL files via `executeSql` in order.

The drift audit performed on 2026-05-02 (under Task #46) is preserved at `lib/db/drizzle/_drift-audit-2026-05-02.md` for posterity.

## External Dependencies

- **Database**: PostgreSQL (Replit built-in) managed with Drizzle ORM.
- **Authentication**: Supabase Auth.
- **Storage**: Supabase Storage for file uploads and management.
- **Payment Processing**: Stripe (for future phases, `project_entitlements` table is ready).
- **AI Drafting**: OpenAI API (for note drafting).
- **Export Generation**: In-process PDF (`pdfkit` + `fontkit`) and Word (`docx`) renderers in the API server. `pdfkit` and its native deps (`fontkit`, `linebreak`, `unicode-properties`, `unicode-trie`, `tiny-inflate`, `dfa`, `restructure`, `brotli`, `png-js`) are externalized in `build.mjs` so they resolve against the pnpm-managed `node_modules` at runtime. Generated files are stored in the Supabase `exports` (paid) or `demo-assets` (demo) buckets and served via short-lived signed URLs through `/api/exports/:id/download`.