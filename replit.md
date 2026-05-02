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
- **Database**: PostgreSQL + Drizzle ORM (Replit built-in; Supabase PostgreSQL planned for Phase 2; schema in `lib/db`)
- **Auth**: Supabase Auth (JWT-based; frontend uses `@supabase/supabase-js`, backend validates via service role key)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml` → React Query hooks + Zod schemas)
- **Build**: esbuild (CJS bundle for API server)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema to database (requires DATABASE_URL secret)

## Artifacts

| Artifact | Kind | Preview Path | Port | Purpose |
|----------|------|-------------|------|---------|
| `web` | React/Vite | `/` | 22333 | Main frontend — all user-facing pages |
| `api-server` | API | `/api` | 8080 | Express 5 backend — all server routes |
| `mockup-sandbox` | Design | `/__mockup` | 8081 | UI prototyping only, not production |

## Auth Flow

- Unauthenticated users are redirected to `/login`
- Login/register pages redirect already-authenticated users to `/`
- All API routes (except `/api/health`) require `Authorization: Bearer <token>`
- The frontend's custom fetch mutator (`lib/api-client-react/src/custom-fetch.ts`) injects the token automatically via `setAuthTokenGetter` wired in `AuthContext`
- Backend verifies tokens using `supabaseAdmin.auth.getUser(token)` in `src/middlewares/auth.ts`

## Environment Variables / Secrets

| Name | Used by | Purpose |
|------|---------|---------|
| `VITE_SUPABASE_URL` | Frontend + Backend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Public anon key for Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Service role key for JWT verification |
| `SESSION_SECRET` | Backend | Express session secret |
| `DATABASE_URL` | Backend | Replit built-in PostgreSQL connection string |

## Frontend Routes (`artifacts/web/`)

| Route | Component | Notes |
|-------|-----------|-------|
| `/` | `LandingPage` | Hero, 8-step workflow, trust section |
| `/login` | `LoginPage` | Auth pages (Supabase stub) |
| `/signup` | `SignupPage` | Auth pages (Supabase stub) |
| `/dashboard` | `DashboardPage` | Demo card + locked real project card |
| `/demo/:section?` | `DemoWorkspacePage` | 8 sections, read-only, Nordic Design AB demo data + guidance panel |
| `/workspace/:section?` | `PaidWorkspacePage` | Paid workspace shell with payment banner + sidebar |
| `/pricing` | `PricingPage` | 999 kr per report + coming soon subscription |

## Demo Workspace Sections

1. `overview` — Company info + project status badges + 9-step WorkflowProgress
2. `import` — SIE file import summary (locked upload)
3. `mapping` — Account mapping table with confidence badges
4. `statements` — Resultaträkning + Balansräkning with note references
5. `notes` — 8 expandable K3 notes in Swedish
6. `validation` — 1 warning + 1 error, read-only
7. `review` — Locked review/comment cards
8. `export` — Watermarked DEMO preview, locked PDF/Word export

## Key Source Files

- `artifacts/web/src/App.tsx` — routing setup with LanguageProvider, Router, TooltipProvider
- `artifacts/web/src/contexts/LanguageContext.tsx` — SV/EN toggle persisted to localStorage
- `artifacts/web/src/i18n/strings.ts` — all UI strings in Swedish and English
- `artifacts/web/src/data/demoData.ts` — Nordic Design AB 2024 demo data (K3)
- `artifacts/web/src/hooks/useAuth.ts` — stub (wired to Supabase Auth in Phase 2)
- `artifacts/web/src/components/Layout.tsx` — nav header + footer, language toggle, skip link
- `artifacts/web/src/components/WorkflowProgress.tsx` — 9-step workflow tracker (not-started/current/completed/needs-review/blocked)
- `artifacts/web/src/components/GuidancePanel.tsx` — collapsible right-side contextual help panel
- `artifacts/web/src/components/badges/` — 10 reusable UX badge components
- `artifacts/web/src/components/cards/` — 11 card components (SummaryCard, StatusCard, ActionCard, LockedFeatureCard, DemoDataCard, WarningCard, ValidationIssueCard, FinancialStatementSummaryCard, NoteCard, CommentReviewCard, ExportReadinessCard)
- `artifacts/web/src/components/tables/` — 6 table components (AccountMappingTable, FinancialStatementTable, NotesTable, ValidationTable, AuditLogTable, UsersRolesTable)
- `artifacts/web/src/components/guidance/` — 6 guidance components (InlineHelp, BASLogicExpander, AIConfirmationBanner, ReviewedBanner, DemoGuidanceBanner, LockedGuidanceBanner)
- `artifacts/web/src/components/states/` — 6 state components (EmptyState, LoadingState, ErrorState, UploadProgressState, ParseSpinnerState, GenerationSkeletonState)
- `artifacts/api-server/src/routes/projects.ts` — **stub** — all return 501 (Phase 2)
- `lib/db/src/schema/` — Drizzle table definitions (not pushed to DB yet)
- `lib/api-spec/openapi.yaml` — OpenAPI 3.1 spec (source of truth for codegen)

## Artifact Path Note

The `artifacts/arsredovisningar` artifact (an older/parallel implementation) has been moved to `/arsredovisningar/` to avoid proxy routing conflict with the canonical `artifacts/web` at `/`.

## Documentation

All project documentation lives in `docs/`:

- `docs/build-phases.md` — recommended phase order and status
- `docs/phase-1-summary.md` — full Phase 1 summary: what was built, what's incomplete, next steps
- `docs/functionality-specification.md` — product specification
- `docs/mvp-build-blueprint.md` — MVP scope and architecture decisions
- `docs/backend-security-notes.md` — environment variable rules, RLS, API security
- `docs/replit-setup-notes.md` — full setup status, secrets, Supabase/GitHub readiness

## Phase Status

- **Phase 0** ✅ Complete — structure reviewed, docs created
- **Phase 1** ✅ Complete — frontend shell, backend API, real seeded data
- **Phase 1.5** ✅ Complete — Supabase Auth wired end-to-end (login, register, protected routes, backend JWT middleware)
- **Phase 2** ⏳ Not started — migrate database to Supabase PostgreSQL, add user-scoped data (RLS)
- **Phase 4** ⏳ Not started — Stripe account + Phase 2

## Important Design Decisions

- **Language**: UI is SV/EN toggleable. Annual report content (notes, statements, headings) is **always Swedish** — non-negotiable for ÅRL compliance.
- **Framework**: K3 (BFNAR 2012:1) is the primary framework. K2 deferred to later phase.
- **Auth**: `useAuth()` is wired to Supabase Auth.
- **Payments**: `initiateCheckout()` in PricingPage is a stub (Phase 4). No Stripe SDK installed yet.
- **IDs**: All DB primary keys use UUID (Supabase-compatible).
