# Phase 1 Summary — Årsredovisningar Product Shell

**Completed:** May 2026
**Phase:** 1 — Core frontend and routing

---

## What Was Built

### Web App Artifact (`artifacts/web/`)
A complete React + Vite frontend registered at `/` (root path). The app is fully self-contained with no backend dependencies — all demo data is static.

**Routes:**
- `/` — Landing page with hero, 8-step workflow, bilingual CTA
- `/login` — Auth placeholder (Supabase not yet wired)
- `/signup` — Auth placeholder (Supabase not yet wired)
- `/dashboard` — Dashboard with demo workspace card and locked real project card
- `/demo/:section?` — Full demo workspace (8 sections, read-only)
- `/pricing` — Payment gate with placeholder pricing cards

**Language support:**
- Swedish/English toggle via `LanguageContext`
- Swedish is the default
- Annual report output (statements, notes) is always Swedish regardless of UI language setting
- String maps in `artifacts/web/src/i18n/strings.ts`

**Demo data (`artifacts/web/src/data/demoData.ts`):**
- Company: Nordic Design AB (556123-4567, K3, FY 2024)
- SIE import summary
- 6 mapped accounts with confidence levels
- Full income statement (resultaträkning) with note references
- Full balance sheet (balansräkning) with note references
- 8 K3 notes with Swedish content
- 2 validation results (1 warning, 1 error)

**Demo workspace sections:**
1. Overview — status cards
2. Import data — SIE file summary, upload locked
3. Account mapping — read-only mapping table with confidence badges
4. Financial statements — income statement + balance sheet with note references
5. Notes — 8 numbered K3 notes with cross-references
6. Validation — 1 warning + 1 error in read-only state
7. Review — locked review comment cards
8. Preview & export — watermarked placeholder with locked export buttons

**Reusable UX components (`artifacts/web/src/components/badges/`):**
- `DemoDataBadge` — amber pill indicating demo content
- `LockedFeatureTooltip` — lock overlay for payment-gated controls
- `StatusBadge` — color-coded status indicator (draft/done/warning/error/in_progress)
- `ConfidenceBadge` — account mapping confidence (high/medium/low)
- `NoteReferenceBadge` — "Not N" clickable badge
- `LinkedNoteIndicator` — cross-reference indicator
- `WhyRequired` — expandable K3 requirement explanation
- `ShowSourceAccounts` — expandable BAS account list
- `ShowCalculation` — expandable arithmetic breakdown
- `ManualOverridePlaceholder` — locked manual input placeholder

### DB Schema (`lib/db/src/schema/`)
Drizzle ORM table definitions only — not pushed to any database (Supabase not yet configured):
- `profiles` — user profiles (links to Supabase Auth uid in Phase 1.5)
- `companies` — Swedish legal entities with organisationsnummer
- `annual_report_projects` — one project per company per fiscal year
- `project_access` — many-to-many profile ↔ project with roles
- `project_entitlements` — payment gate (Stripe in Phase 4)
- `audit_events` — immutable event log

### API Stubs (`artifacts/api-server/src/routes/projects.ts`)
- `GET /api/projects` → 501
- `POST /api/projects` → 501
- `GET /api/projects/:id` → 501
- `GET /api/companies` → 501
- `POST /api/companies` → 501

OpenAPI spec updated in `lib/api-spec/openapi.yaml` with schemas for projects and companies.

---

## What Is Incomplete / Not Yet Working

- **Supabase Auth** — Login/signup forms exist but auth is not wired. `useAuth()` returns stub values. Protected routes do not enforce authentication.
- **DB migrations** — Schema definitions exist but no database has been provisioned. `pnpm --filter @workspace/db run push` will fail until `DATABASE_URL` is set.
- **Stripe payments** — `initiateCheckout()` is a stub with a TODO comment. No Stripe SDK is installed.
- **Real SIE import** — Upload area exists but is locked. No SIE parsing logic.
- **Real account mapping** — Mapping table is read-only demo. No mapping engine.
- **Real validation engine** — Validation section shows static demo results.
- **Real PDF/Word export** — Export buttons are locked. No export service.
- **K2 framework** — Demo data and notes are K3 only. K2 is deferred.

---

## Assumptions Made

1. K3 is the primary framework for Phase 1 demo data. K2 will be added later.
2. Swedish is the mandatory language for annual report output (ÅRL compliance).
3. The pricing is placeholder (999 kr per report) and may change.
4. The `useAuth()` stub signature matches what Supabase Auth will return in Phase 1.5 — minimal changes needed to wire it up.
5. The DB schema uses UUIDs for all primary keys (Supabase-compatible).

---

## What to Test Manually

1. Landing page loads at `/`
2. Language toggle switches SV/EN on all UI labels
3. "Utforska demo" CTA navigates to `/demo`
4. Demo workspace sidebar navigates all 8 sections
5. Demo workspace shows "Read-only demo" banner throughout
6. Statement tables show NoteReferenceBadge on rows with noteRef
7. Notes section shows 8 numbered notes with Swedish content
8. Validation section shows 1 warning + 1 error
9. Dashboard shows demo card (green) and real project card (locked)
10. Pricing page shows 2 cards (active + grayed out)
11. Login/signup pages show "Supabase Auth not yet configured" banner
12. `/api/healthz` returns `{ status: "ok" }`
13. `/api/projects` returns 501

---

## Next Steps (Phase 1.5)

1. Create a Supabase project and add secrets to Replit
2. Wire `useAuth()` to Supabase Auth
3. Protect `/dashboard` and `/demo` behind authentication
4. Push DB schema: `pnpm --filter @workspace/db run push`
