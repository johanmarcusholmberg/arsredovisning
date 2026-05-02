# Årsredovisningar

## Overview

pnpm workspace monorepo using TypeScript. A web application for preparing Swedish annual reports (årsredovisningar).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (wouter routing, shadcn/ui, TanStack Query, Zod v4)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (Replit built-in; Supabase PostgreSQL planned for Phase 2)
- **Auth**: Supabase Auth (JWT-based; frontend uses `@supabase/supabase-js`, backend validates via service role key)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Artifacts

| Artifact | Kind | Preview Path | Purpose |
|----------|------|-------------|---------|
| `arsredovisningar` | Web | `/` | React + Vite frontend |
| `api-server` | API | `/api` | Express 5 backend — all server routes |
| `mockup-sandbox` | Design | `/__mockup` | UI prototyping only, not production |

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

## Documentation

All project documentation lives in `docs/`:

- `docs/build-phases.md` — recommended phase order and status
- `docs/functionality-specification.md` — product specification
- `docs/mvp-build-blueprint.md` — MVP scope and architecture decisions
- `docs/backend-security-notes.md` — environment variable rules, RLS, API security
- `docs/replit-setup-notes.md` — full setup status, secrets, Supabase/GitHub readiness

## Phase Status

- **Phase 0** ✅ Complete — structure reviewed, docs created
- **Phase 1** ✅ Complete — frontend shell, backend API, real seeded data
- **Phase 1.5** ✅ Complete — Supabase Auth wired end-to-end (login, register, protected routes, backend JWT middleware)
- **Phase 2** ⏳ Not started — migrate database to Supabase PostgreSQL, add user-scoped data (RLS)
