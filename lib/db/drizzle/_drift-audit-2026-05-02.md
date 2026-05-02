# Drizzle ↔ Postgres Drift Audit — 2026-05-02

Performed under Task #46 ("Heal Drizzle ↔ Postgres schema drift").

## Inputs

- **Schema source of truth**: `lib/db/src/schema/*.ts` (introspected via `drizzle-orm`'s `getTableConfig`, see `scripts/src/dumpSchemaColumns.ts`).
- **Live DB inspection**: `information_schema.columns`, `pg_constraint`, `pg_policies`, `pg_class.relrowsecurity` against `DATABASE_URL`.

## Pre-state row counts

| Table                                          | Rows |
|------------------------------------------------|------|
| profiles                                       | 2    |
| companies                                      | 1    |
| All other tables (24)                          | 0    |

No RLS policies were active and no tables had `rowsecurity` enabled. Schema files document RLS expectations but they had not been applied to the live DB. **Re-applying RLS is therefore out of scope of this audit** — there were no policies to preserve.

## Drift categories detected

### Missing tables (10)

The following schema-defined tables had no corresponding live table:

`account_mappings`, `import_batches`, `mapping_overrides`, `mapping_rules`, `mapping_templates`, `project_files`, `staging_accounts`, `staging_balances`, `staging_transactions`, `user_preferences`

### Missing enum types (20)

`accounting_framework`, `project_status`, `annual_report_language`, `project_role`, `entitlement_type`, `upload_status`, `parse_status`, `statement_type`, `note_reference_status`, `previous_year_source`, `note_requirement_level`, `note_status`, `report_section`, `review_status`, `validation_level`, `report_role`, `import_file_type`, `batch_status`, `mapping_confidence`, `mapping_status`

These columns existed as `text` with `CHECK (col = ANY(ARRAY[...]))` constraints. Schema declares them as enum types.

### Per-table column drift

| Table                          | Drift                                                                                                                                                                  | Decision                                                              |
|--------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| `companies` (1 row)            | EXTRA `fiscal_year_start` (text "01-01"), EXTRA `fiscal_year_end` (text "12-31"); `accounting_framework` is text                                                       | Drop extras (semantics moved to `annual_report_projects`); enum cast  |
| `annual_report_projects`       | `accounting_framework`, `annual_report_language`, `status` are text; `section_status_json` is text not jsonb                                                            | Cast to enums; `text → jsonb` via `COALESCE(...::jsonb,'{}'::jsonb)`  |
| `project_access` (0 rows)      | EXTRA `id`, `granted_at`; MISSING `granted_by_profile_id`, `created_at`; `role` is text                                                                                  | Drop `id`; rename `granted_at→created_at`; add FK; enum cast; rebuild PK on (profile_id, project_id) |
| `project_entitlements` (0 rows)| EXTRA `status`; MISSING `entitlement_type`, `source`, `is_active`, `stripe_subscription_id`, `valid_from`, `valid_until`, `updated_at`; `profile_id` was NOT NULL       | Drop `status`; relax `profile_id`; add 7 columns                       |
| `financial_statement_lines`    | `statement_type`, `previous_year_source`, `framework` are text                                                                                                          | Cast to enums                                                          |
| `note_statement_references`    | `statement_type` is text                                                                                                                                                | Cast to enum                                                           |
| `report_collaborators`         | `role` is text                                                                                                                                                          | Cast to enum                                                           |
| `report_note_references`       | `statement_type`, `reference_status` are text                                                                                                                            | Cast to enums                                                          |
| `report_notes`                 | `requirement_level`, `status`, `framework` are text                                                                                                                      | Cast to enums                                                          |
| `section_comments`             | `section` is text                                                                                                                                                       | Cast to enum                                                           |
| `section_reviews`              | `section`, `status` are text                                                                                                                                             | Cast to enums                                                          |
| `profiles` (2 rows)            | Missing UNIQUE on `auth_id` and `email` constraints (the `*_unique` named ones; underlying unique behaviour was present via index)                                       | Add named unique constraints                                           |
| `companies` (1 row)            | Missing named UNIQUE on `organization_number`                                                                                                                            | Add named unique constraint                                            |

No columns containing data were dropped. The two columns dropped from `companies` (`fiscal_year_start`, `fiscal_year_end`) only held the literal strings `"01-01"`/`"12-31"`, which are placeholder defaults; the live entity used `annual_report_projects.fiscal_year_start/end` (date type) instead.

## Corrective actions applied

1. Dropped legacy `CHECK ((col = ANY(ARRAY['x'::text, ...])))` constraints across all enum-bearing tables.
2. Created the 20 missing enum types via idempotent `DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` blocks.
3. Per-table: dropped extra columns, renamed `project_access.granted_at → created_at`, added missing columns, and cast text columns to enum types preserving defaults (`DROP DEFAULT → ALTER TYPE ... USING ::enum → SET DEFAULT`).
4. Rebuilt `project_access` PK on `(profile_id, project_id)` (was `(id)`).
5. Pre-created the named unique constraints on `profiles.auth_id`, `profiles.email`, `companies.organization_number` so `drizzle-kit push --force` would not prompt to truncate non-empty tables.
6. Ran `pnpm --filter @workspace/db run push --force`. drizzle-kit reported `[✓] Changes applied` and on a second run made no further changes — the 10 missing tables, all FKs and indexes were created in this step.
7. Verified push reports `[✓] Changes applied` then a clean re-run with no further changes — the live DB is now in lockstep with the schema files. No new migration file was generated, because in this project the existing `0000`–`0003` SQL files are historical only and `drizzle-kit migrate` is **not** part of any runtime/deployment path. Adding a synthesized `0004` baseline would non-idempotently re-`CREATE` objects already created by `0002`/`0003` and break any future replay. Drift is now enforced by `scripts/src/checkSchemaDrift.ts` instead.

## Verification

A re-run of the comparison produced **0 drifted tables, 0 drift items**. `drizzle-kit push --force` reports no changes on subsequent runs.

The drift-detection guardrail (`scripts/src/checkSchemaDrift.ts`) was added and wired into the root `pnpm typecheck` chain so any future drift will fail typecheck. See `replit.md` § Database migrations.
