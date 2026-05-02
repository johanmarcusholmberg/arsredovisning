# Replit Setup Notes — Årsredovisningar

## Current Project State (Phase 0)

Reviewed on: 2026-05-02

### Project Structure

| Item | Status | Notes |
|------|--------|-------|
| Monorepo tool | ✅ pnpm workspaces | Configured at root `pnpm-workspace.yaml` |
| Node.js version | ✅ 24 | Confirmed in workspace config |
| TypeScript | ✅ v5.9 | Strict mode, shared `tsconfig.base.json` |
| Frontend framework | ⚠️ Not yet created | A `react-vite` artifact needs to be created in Phase 1 |
| Routing structure | ⚠️ Not yet created | Will be set up when frontend artifact is created |
| Component structure | ⚠️ Not yet created | mockup-sandbox has shadcn/ui components (for prototyping only) |
| Styling system | ⚠️ Not yet created | Will use Tailwind CSS + shadcn/ui in the frontend artifact |
| Backend framework | ✅ Express 5 | Scaffolded at `artifacts/api-server` |
| Database ORM | ✅ Drizzle ORM | `lib/db` package exists; schema is empty (ready for Phase 2) |
| API contract | ✅ OpenAPI + Orval codegen | `lib/api-spec/openapi.yaml`; currently only has a `/healthz` endpoint |
| Validation | ✅ Zod v4 + drizzle-zod | Ready to use when routes are added |
| Authentication | ❌ Not configured | Must be set up in Phase 1.5 |
| Supabase | ❌ Not configured | See Supabase Readiness section below |
| GitHub | ❌ Not connected | See GitHub Readiness section below |
| Documentation | ✅ Created in Phase 0 | This docs/ folder |

---

## Environment Variables

### Frontend-safe variables (add to Replit Secrets, accessible via `VITE_` prefix)

| Variable | Status | Description |
|----------|--------|-------------|
| `VITE_SUPABASE_URL` | ❌ Missing | Supabase project URL — needed from Phase 2 |
| `VITE_SUPABASE_ANON_KEY` | ❌ Missing | Supabase anonymous key — needed from Phase 2 |

### Server-only variables (add to Replit Secrets, never import in frontend)

| Variable | Status | Description |
|----------|--------|-------------|
| `SESSION_SECRET` | ✅ Present | Express session signing secret |
| `DATABASE_URL` | ✅ Present | PostgreSQL connection string (Replit built-in DB) |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ Missing | Supabase admin key — needed from Phase 2 |
| `STRIPE_SECRET_KEY` | ❌ Missing | Stripe payment processing — needed from Phase 4 |
| `STRIPE_WEBHOOK_SECRET` | ❌ Missing | Stripe webhook verification — needed from Phase 4 |
| `AI_PROVIDER_KEY` | ❌ Missing | AI provider (OpenAI/Anthropic) — needed from Phase 5 |
| `EXPORT_SERVICE_KEY` | ❌ Missing | PDF/Word export service — needed from Phase 3.5 |

> **Rule:** Variables prefixed with `VITE_` are bundled into the frontend and visible in the browser. All other variables are server-only. Never add `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, or other sensitive keys with a `VITE_` prefix.

---

## Supabase Readiness

**Status: ❌ Not configured**

Supabase is not yet connected to this project. No Supabase client code exists.

### What needs to happen before Phase 2

1. Create a Supabase project at https://supabase.com
2. In Supabase: Project Settings → API → copy the Project URL and anon key
3. In Replit Secrets: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. In Replit Secrets: add `SUPABASE_SERVICE_ROLE_KEY` (from Supabase → Settings → API → service_role key)
5. Install the Supabase client: `pnpm add @supabase/supabase-js` in the frontend artifact
6. Create a `lib/supabase/` client helper or configure per-artifact
7. Enable Row Level Security on all tables from day one
8. Configure Supabase Auth (email/password at minimum)

### Placeholder structure (to create before Phase 2)

```
lib/
  supabase/           ← shared Supabase helpers
    src/
      client.ts       ← browser client (uses VITE_ keys)
      server.ts       ← server client (uses service role key)
    package.json
    tsconfig.json
```

> **Note:** This project currently uses Replit's built-in PostgreSQL via Drizzle ORM. A decision is needed before Phase 2: use Replit's built-in DB with Drizzle, or switch to Supabase's PostgreSQL. Mixing both is not recommended.

---

## GitHub Readiness

**Status: ❌ Not connected**

The project has a local git repository with one commit on branch `main`, but no GitHub remote is configured.

```
Branch: main
Commits: 1 (Initial commit)
Remote: none
```

### Recommended action before Phase 1

Connect this Replit project to a GitHub repository:

1. Create a repository on GitHub (private recommended)
2. In Replit: Version Control → Connect to GitHub
3. Push the initial commit
4. From this point on, commit at the end of each phase

> **Before connecting:** Verify that `.gitignore` covers `.env` files, `node_modules`, and any secrets. Check `scripts/post-merge.sh` and ensure no secrets are referenced inline.

---

## Existing Artifacts

| Artifact | Kind | Path | Purpose |
|----------|------|------|---------|
| `api-server` | API | `/api` | Express 5 backend — all server routes go here |
| `mockup-sandbox` | Design | `/__mockup` | UI prototyping only — not a production artifact |

**Missing artifact:** A `react-vite` web application artifact at `/` needs to be created in Phase 1. This will be the main user-facing frontend.

---

## Phase 0 Acceptance Criteria

- [x] Project structure reviewed and documented
- [x] `docs/` folder created with all required files
- [x] Environment variables documented with frontend-safe vs server-only classification
- [x] Supabase readiness documented (not configured — steps provided)
- [x] GitHub readiness documented (not connected — steps provided)
- [x] Recommended phase implementation order documented in `docs/build-phases.md`
- [x] No product functionality built
