# Årsredovisningar

## Overview

This project is a pnpm monorepo web application designed for preparing Swedish annual reports (årsredovisningar) for accounting firms. It ensures ÅRL compliance by generating reports exclusively in Swedish, while offering a dual-language (Swedish/English) UI. The system streamlines report generation through features like financial statement creation, AI-drafted note management, robust validation, collaboration tools, and a comprehensive audit trail. The ambition is to provide a comprehensive, compliant, and efficient solution for annual report preparation.

## User Preferences

- The UI language can be toggled between Swedish and English.
- Annual report content must always be in Swedish for ÅRL compliance.
- All primary keys in the database should use UUIDs.
- Critical environment variables (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `OPENAI_API_KEY`) must be server-only and never exposed to the browser.
- When pushing DB schema, prefer raw SQL migrations via `executeSql` in CI over `drizzle-kit push --force` due to interactive prompts.
- All schema drift between `lib/db/src/schema/*.ts` and the live Postgres database must be zero. The root `pnpm typecheck` command runs `pnpm run check-schema-drift` (script: `scripts/src/checkSchemaDrift.ts`) at the end of the pipeline and fails on any drift.
- Avoid using `format: date` in OpenAPI specifications for fiscal year fields to prevent type mismatches with generated Zod schemas.

## System Architecture

The application is built as a pnpm monorepo using Node.js 24 and TypeScript 5.9, with an Express 5 API server.

### UI/UX Decisions
- **Frontend**: React 19 with Vite, `wouter` for routing, `shadcn/ui` for components, `TanStack Query` for data fetching, `Zod v4` for schema validation, `Tailwind v4` for styling, and `framer-motion` for animations.
- **Language**: UI is SV/EN toggleable; report output is exclusively in Swedish.
- **Workflow**: A 9-step tracker monitors report progress.
- **Design System**: Semantic palette tokens based on "Nordic Calm" for consistent theming; PDF/Word exports disregard decorative tokens.
- **Responsiveness**: Content padding scales for various screen sizes.

### Technical Implementations
- **Monorepo**: Managed with pnpm workspaces.
- **API Codegen**: Orval generates React Query hooks and Zod schemas from an OpenAPI spec.
- **Authentication**: Supabase Auth (JWT-based) with backend validation. Profile synchronization ensures user data exists.
- **Backend Security**: Named permission checkers, non-throwing audit logging, and helpers for demo project detection. The API server connects with the Supabase service role key, bypassing RLS.
- **Validation Engine**: Deterministic rules produce `blocking`, `warning`, or `info` levels with `isHighRisk` flags and deep-linking capabilities.
- **Note Module**: Manages report notes with auto-numbering and AI drafting.
- **Collaboration**: Features section reviews, threaded comments, and role-based access.
- **Audit Trail**: Append-only `audit_events` table and `project_snapshots` for data captures.
- **Core Functionality**: Manages companies, projects, and reports.
- **Financial Statements**: Generates income statements, balance sheets, and cash flow statements (K2/K3 frameworks), including drilldown, comparisons, and dynamic report structures with completion tracking. Cash flow statements include legal requirement assessment, indirect method generation, and validation.
- **File Management**: Secure upload/download of project files with permission gating.
- **Export**: Generates PDF/Word exports with watermarks for demo projects, using a single `AnnualReportExportData` contract for consistency. Exports include consistency checks, readiness gating, and signed-URL downloads.
- **User Settings**: Comprehensive settings page for display name, email (Supabase confirmation flow), language, and notification preferences. Password changes re-verify current password and re-authenticate.
- **Launch Polish**: Includes an internal launch checklist for readiness and compliance wording emphasizing the tool as a compliance assistant.

### System Design Choices
- **Accounting Framework**: K3 (BFNAR 2012:1) is primary.
- **Demo Handling**: Dedicated `helpers/demo.ts` ensures demo projects use `demo-assets` storage buckets and apply watermarks, strictly separating them from production assets.
- **API Routes**: Comprehensive RESTful API endpoints, all requiring authentication unless explicitly public.
- **Frontend Routes**: Structured routing for dashboard, authentication, company management, report workspaces, financial statements, and user settings.
- **Database Schema Management**: Drizzle schema files in `lib/db/src/schema/*.ts` are the single source of truth. Schema changes are applied via `drizzle-kit push --force` in development, with historical SQL snapshots generated. A schema drift check ensures consistency between the Drizzle schema and the live database.
- **Row-Level Security (RLS)**: All user-data tables documented in `docs/rls-policies.sql` have RLS enabled in the live DB. The applied policies live in two migration files: `lib/db/drizzle/0003_phase_6_5_reclassification_rls.sql` (reclassification tables) and `lib/db/drizzle/0005_apply_full_rls.sql` (profiles, user_preferences, companies, annual_report_projects, project_access, project_entitlements, audit_events, project_snapshots, project_files, export_files, reports). Both rely on the `auth_profile_id()` helper from `0004_phase_6_5_rls_function.sql`, which resolves the caller's `profiles.id` from the JWT `sub` claim (`current_setting('request.jwt.claim.sub', true)`); the API server connects with the service-role/superuser DB URL and therefore bypasses RLS, so these policies primarily defend direct browser/anon-role access. The `pg_policies` smoke check inside `scripts/src/checkSchemaDrift.ts` (FLAGS.rls) asserts the expected per-table policy counts, so any policy that silently disappears fails `pnpm typecheck`. When adding or removing a policy, update both the matching `*_rls.sql` migration **and** the `expectedPolicyCounts` map in the drift checker.

## External Dependencies

- **Database**: PostgreSQL (Replit built-in) managed with Drizzle ORM.
- **Authentication**: Supabase Auth.
- **Storage**: Supabase Storage for file uploads and management.
- **Payment Processing**: Stripe (integrated for future use).
- **AI Drafting**: OpenAI API.
- **Export Generation**: In-process PDF (`pdfkit`) and Word (`docx`) renderers, externalizing native dependencies for runtime resolution. Generated files are stored in Supabase buckets (`exports` or `demo-assets`) and served via short-lived signed URLs.