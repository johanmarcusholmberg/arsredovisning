# MVP Build Blueprint — Årsredovisningar

> **Status:** Placeholder. Update with detailed MVP scope before Phase 1 begins.

## MVP Goal

Deliver a working end-to-end flow where a user can:

1. Log in
2. Create a company and fiscal year
3. Import or enter basic financial data
4. Generate a minimal but legally valid annual report
5. Export it as a PDF or Word document

The MVP does **not** need to cover all note types, all legal forms, or AI assistance.

---

## MVP Scope

### Included

- [ ] User authentication (email/password via Supabase Auth)
- [ ] Create and manage a single company
- [ ] Define fiscal year
- [ ] Manual entry of balance sheet and income statement figures
- [ ] Basic required notes (accounting policies, depreciation)
- [ ] PDF export
- [ ] Stripe payment gate for export

### Excluded from MVP

- [ ] SIE file import
- [ ] AI note suggestions
- [ ] Word export
- [ ] Multiple users per company
- [ ] K3 framework (K2 only for MVP)
- [ ] Auditor workflow

---

## Technical MVP Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite (to be created as react-vite artifact) |
| Backend | Express 5 (already scaffolded at `artifacts/api-server`) |
| Database | PostgreSQL via Drizzle ORM (schema to be defined in Phase 2) |
| Auth | Supabase Auth or Clerk (decision before Phase 1.5) |
| Payments | Stripe (Phase 4) |
| Export | PDF generation library — TBD (Phase 3.5) |

---

## Key Architecture Decisions Needed Before Phase 1

1. **Authentication provider** — Supabase Auth vs. Clerk. Supabase Auth is the natural choice if Supabase is used for the database.
2. **Frontend routing** — React Router v6 or TanStack Router.
3. **PDF export library** — server-side (`puppeteer`, `pdfmake`) or client-side (`react-pdf`).
4. **Report template approach** — static HTML templates rendered to PDF, or a dedicated document service.

---

> Update this file with confirmed decisions and a phased feature checklist before each phase begins.
