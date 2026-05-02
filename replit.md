# Årsredovisningar

## Overview

pnpm workspace monorepo using TypeScript. A web application for preparing Swedish annual reports (årsredovisningar).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (Replit built-in, schema empty — awaiting Phase 2)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Artifacts

| Artifact | Kind | Preview Path | Purpose |
|----------|------|-------------|---------|
| `api-server` | API | `/api` | Express 5 backend — all server routes |
| `mockup-sandbox` | Design | `/__mockup` | UI prototyping only, not production |

**Missing:** A `react-vite` frontend artifact at `/` — to be created in Phase 1.

## Documentation

All project documentation lives in `docs/`:

- `docs/build-phases.md` — recommended phase order and status
- `docs/functionality-specification.md` — product specification (placeholder, fill before Phase 1)
- `docs/mvp-build-blueprint.md` — MVP scope and architecture decisions (placeholder)
- `docs/backend-security-notes.md` — environment variable rules, RLS, API security
- `docs/replit-setup-notes.md` — full setup status, missing secrets, Supabase/GitHub readiness

## Phase Status

- **Phase 0** ✅ Complete — structure reviewed, docs created
- **Phase 1** ⏳ Not started — requires GitHub + Supabase setup first

## Setup Still Required

1. Connect Replit project to GitHub (no remote configured yet)
2. Create Supabase project and add secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. Decide: Replit built-in PostgreSQL + Drizzle vs. Supabase PostgreSQL (pick one before Phase 2)

See `docs/replit-setup-notes.md` for the full setup checklist.
