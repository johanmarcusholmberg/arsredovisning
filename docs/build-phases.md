# Build Phases — Årsredovisningar

## Recommended Implementation Order

1. **GitHub repository connected to Replit**
   Connect the Replit project to a GitHub repository before deeper phases begin. This enables version control, rollback safety, and collaboration.

2. **Supabase project created**
   Create a Supabase project (https://supabase.com). Note the Project URL and anon key from Project Settings → API.

3. **Supabase URL and anon key added to Replit Secrets**
   Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Replit Secrets (not hardcoded). Add `SUPABASE_SERVICE_ROLE_KEY` as a server-only secret.

4. **Phase 0 — Project setup and implementation readiness** ✅
   Review project structure, create documentation, document environment variables, confirm Supabase and GitHub readiness.

5. **Phase 1 — Core frontend and routing** ✅
   Build the main React web application artifact. Set up page routing, navigation, and layout structure. Includes:
   - Full React/Vite app at `/` with wouter routing
   - Landing page with hero, 8-step workflow, and bilingual (SV/EN) UI
   - Language context (Swedish/English) with useTranslation hook
   - Demo workspace with all 8 sections, pre-populated with Nordic Design AB dummy data
   - Auth placeholder pages (login, signup) with stub useAuth hook
   - Dashboard with demo workspace card and locked real project card
   - Payment gate (/pricing) with placeholder pricing cards
   - Reusable UX components: DemoDataBadge, LockedFeatureTooltip, StatusBadge, ConfidenceBadge, NoteReferenceBadge, LinkedNoteIndicator, WhyRequired, ShowSourceAccounts, ShowCalculation, ManualOverridePlaceholder
   - DB schema definitions (profiles, companies, annual_report_projects, project_access, project_entitlements, audit_events)
   - API stub routes for /api/projects and /api/companies (returning 501)

6. **Phase 1.5 — Authentication**
   Integrate Supabase Auth. Wire the stub useAuth hook to real Supabase Auth. Protect routes (dashboard, demo). User session management.
   - Requires: Supabase project + VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY secrets
   - Replace placeholder auth pages with real Supabase Auth flow

7. **Phase 2 — Backend and data layer (requires Supabase)**
   Implement API routes in the Express server. Connect to Supabase/PostgreSQL via Drizzle ORM. Push DB schema to Supabase. Build database operations for companies, fiscal years, and report metadata.
   - Push `lib/db` schema with `pnpm --filter @workspace/db run push`
   - Implement the /api/projects and /api/companies routes (currently returning 501)

8. **Phase 2.5 — Import and mapping (requires Phase 2)**
   Build the SIE file import pipeline. Map incoming financial data to the Swedish annual report structure. Validate inputs. Handle edge cases.

9. **Phase 3 — Annual report engine**
   Build the report generation engine. Notes, disclosures, accounting policies. Validation and completion checks.

10. **Phase 3.5 — Export (PDF/Word)**
    Implement real PDF and Word export. Connect to an export service or generate server-side.

11. **Phase 4 — Payments (requires Stripe)**
    Implement Stripe checkout. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to Replit Secrets. Gate report export behind payment. Wire the placeholder `initiateCheckout()` function to real Stripe Checkout.

12. **Phase 5 — AI assistance**
    Add AI-assisted note suggestions, accounting policy recommendations. Add AI provider key to Replit Secrets.

---

## Phase Status

| Phase | Status | Blocked By |
|-------|--------|------------|
| 0 | ✅ Complete | — |
| 1 | ✅ Complete | — |
| 1.5 | ⏳ Not started | Supabase project setup |
| 2 | ⏳ Not started | Supabase project + Phase 1.5 |
| 2.5 | ⏳ Not started | Phase 2 |
| 3 | ⏳ Not started | Phase 2.5 |
| 3.5 | ⏳ Not started | Phase 3 |
| 4 | ⏳ Not started | Stripe account + Phase 3 |
| 5 | ⏳ Not started | AI provider key + Phase 3 |
