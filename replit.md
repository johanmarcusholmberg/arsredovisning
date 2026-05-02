# Årsredovisningar

## Overview

This project is a pnpm monorepo web application using TypeScript, designed for preparing Swedish annual reports (årsredovisningar). It targets Swedish accounting firms, providing a system that ensures ÅRL compliance by generating annual reports exclusively in Swedish, while offering a dual-language (Swedish/English) UI. The project aims to streamline the annual report generation process with features like financial statement generation, note management with AI drafting, validation, collaboration tools, and a comprehensive audit trail.

## User Preferences

- The UI language can be toggled between Swedish and English.
- Annual report content must always be in Swedish for ÅRL compliance.
- All primary keys in the database should use UUIDs.
- Critical environment variables (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `OPENAI_API_KEY`) must be server-only and never exposed to the browser.
- When pushing DB schema, prefer raw SQL migrations via `executeSql` in CI over `drizzle-kit push --force` due to interactive prompts.
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

### System Design Choices
- **Accounting Framework**: K3 (BFNAR 2012:1) is primary.
- **Demo Handling**: Dedicated `helpers/demo.ts` ensures demo projects use `demo-assets` storage buckets and apply watermarks, strictly separating them from production assets.
- **API Routes**: Comprehensive set of RESTful API endpoints covering companies, reports, projects, financial statements, notes, validation, reviews, comments, and audit events, all requiring authentication unless explicitly public.
- **Frontend Routes**: Structured routing for dashboard, login/register, company management, report workspaces, financial statements, and user settings.

## External Dependencies

- **Database**: PostgreSQL (Replit built-in) managed with Drizzle ORM.
- **Authentication**: Supabase Auth.
- **Storage**: Supabase Storage for file uploads and management.
- **Payment Processing**: Stripe (for future phases, `project_entitlements` table is ready).
- **AI Drafting**: OpenAI API (for note drafting).
- **Export Generation**: In-process PDF (`pdfkit` + `fontkit`) and Word (`docx`) renderers in the API server. `pdfkit` and its native deps (`fontkit`, `linebreak`, `unicode-properties`, `unicode-trie`, `tiny-inflate`, `dfa`, `restructure`, `brotli`, `png-js`) are externalized in `build.mjs` so they resolve against the pnpm-managed `node_modules` at runtime. Generated files are stored in the Supabase `exports` (paid) or `demo-assets` (demo) buckets and served via short-lived signed URLs through `/api/exports/:id/download`.