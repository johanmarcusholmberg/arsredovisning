# Supabase Storage Setup

The application stores user uploads (SIE imports, prior-year PDFs, cover sheets,
generated exports) in Supabase Storage. The API server issues short-lived
signed URLs for upload and download — bytes never pass through the API.

## Prerequisites

Set the following secrets (Replit → Secrets):

- `SUPABASE_URL` — e.g. `https://<project-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (server-side only — never ship to the client)

When these are missing the upload/download routes return HTTP 503 with a clear
message; the rest of the API keeps working.

## Buckets

Run the bucket setup script once after Supabase is configured:

```sh
pnpm --filter @workspace/scripts run setup-storage-buckets
```

It creates these buckets idempotently:

| Bucket                    | Privacy | Max size | Purpose                                              |
| ------------------------- | ------- | -------- | ---------------------------------------------------- |
| `import-files`            | private | 50 MB    | Raw SIE / Excel / CSV uploads waiting to be parsed   |
| `previous-annual-reports` | private | 20 MB    | Prior-year PDF reports uploaded as reference         |
| `cover-sheets`            | private | 10 MB    | Per-company cover sheet PDF/image uploads            |
| `exports`                 | private | 50 MB    | Generated PDF / DOCX annual reports                  |
| `demo-assets`             | public  | 20 MB    | Sample SIE files and placeholder exports for the demo |

All non-demo buckets are **private**. Reads must go through a signed URL; the
service role key is the only credential that can bypass this.

## Object path convention

Every object is namespaced by project to prevent cross-tenant collisions:

```
{projectId}/{fileId}/{originalFilename}
```

The `helpers/demo.ts → buildStoragePath()` function is the single source of
truth for this convention.

## Row-Level Security policies

`docs/storage-buckets.md` (in this repo) contains the full Storage RLS policy
SQL. After the buckets are created, paste it into the Supabase SQL editor.

## Local development without Supabase

If `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are unset:

- Upload endpoints respond with **503 `storage_not_configured`** and a Swedish
  message that points operators at the secrets.
- Generated exports fall back to an in-memory cache so PDFs/DOCX can still be
  downloaded for local smoke testing.
