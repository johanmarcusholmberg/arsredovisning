# Supabase Storage Buckets — Årsredovisningar

## Status: Placeholder — Supabase not yet configured

This document defines the five storage buckets required for the Årsredovisningar application.
Once Supabase is configured, run `pnpm --filter @workspace/scripts run setup-storage-buckets`
to create the buckets, or paste the creation calls into a Supabase Edge Function.

---

## Bucket Definitions

| Bucket | Visibility | Purpose |
|--------|-----------|---------|
| `import-files` | Private | Raw SIE, Excel, or CSV files uploaded for import |
| `previous-annual-reports` | Private | Previous year PDF annual reports uploaded as reference |
| `cover-sheets` | Private | Company-specific cover sheet PDF/image uploads |
| `exports` | Private | Generated PDF and Word annual report exports |
| `demo-assets` | Public | Static demo files, sample SIE files, placeholder exports |

---

## Storage Path Conventions

All paths follow a consistent convention to avoid collisions and enable project-scoped queries.

### Private buckets (`import-files`, `previous-annual-reports`, `cover-sheets`, `exports`)

```
{projectId}/{fileId}/{originalFilename}
```

Examples:
- `a1b2c3d4-.../f9e8d7c6-.../balansrakning_2024.sie`
- `a1b2c3d4-.../e3f2a1b0-.../arsredovisning_2023.pdf`

The `fileId` is the UUID from the `project_files` or `export_files` table row.
This ensures deterministic paths and avoids filename collisions across uploads.

### Public bucket (`demo-assets`)

```
demo/{assetType}/{filename}
```

Examples:
- `demo/sie/sample_k2.sie`
- `demo/exports/sample_arsredovisning_watermarked.pdf`
- `demo/covers/default_cover.png`

---

## Access Control

- **Private buckets**: All access via signed URLs (time-limited, 1-hour expiry).
  - Upload: `supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path)`
  - Download: `supabaseAdmin.storage.from(bucket).createSignedUrl(path, 3600)`
  - The backend API generates signed URLs after permission/entitlement checks.
  - Clients NEVER access storage directly with the service role key.

- **Public bucket (`demo-assets`)**: Direct URL access allowed.
  - No signed URL required. Anyone can read demo assets.
  - No PII or customer data is ever stored in this bucket.

---

## Supabase Storage RLS Policies

Supabase Storage uses its own RLS (separate from table RLS). Configure in the Supabase Dashboard
under Storage → Policies, or apply via the Management API.

```sql
-- import-files, previous-annual-reports, cover-sheets, exports:
-- Allow service role full access (handled by supabaseAdmin client).
-- Deny direct access to anon and authenticated roles.
-- All access must go through the API server, which generates signed URLs.

-- demo-assets:
-- Allow public read access.
CREATE POLICY "demo-assets: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'demo-assets');
```

---

## Setup Script

See `scripts/src/setup-storage-buckets.ts` for the automated setup script.
Run it with: `pnpm --filter @workspace/scripts run setup-storage-buckets`

Requirements:
- `SUPABASE_URL` environment variable must be set
- `SUPABASE_SERVICE_ROLE_KEY` environment variable must be set
