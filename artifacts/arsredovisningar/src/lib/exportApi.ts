/**
 * Typed fetch helpers for the Phase 6.6 / Phase 7 export endpoints.
 *
 * The endpoints aren't part of the OpenAPI codegen surface in this phase —
 * they ship as hand-typed wrappers backed by the shared
 * `@workspace/export-contract` types. This keeps preview, server, PDF, and
 * Word locked to the same shape without adding YAML churn.
 */

import { supabase } from "./supabase";
import type {
  AnnualReportExportData,
  ExportReadiness,
  ExportHistoryEntry,
  CoverMode,
  ExportPackageOptions,
  ProjectExportState,
} from "@workspace/export-contract";

// The API server is mounted at the absolute proxy path `/api` (see
// `artifacts/api-server/.replit-artifact/artifact.toml`). It is NOT served
// from this app's BASE_URL prefix, so we must use the absolute path here —
// otherwise requests get rewritten to `/arsredovisningar/api/...` which the
// Vite dev server happily answers with `index.html`, producing
// `Unexpected token '<'` JSON parse errors in the client.
const BASE = "/api";

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new Error(
      `${res.status} ${res.statusText}: ${
        (body as { message?: string } | null)?.message ?? ""
      }`,
    );
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------

export function fetchExportData(reportId: string): Promise<AnnualReportExportData> {
  return call<AnnualReportExportData>(`/reports/${reportId}/export/data`);
}

export function fetchExportReadiness(reportId: string): Promise<ExportReadiness> {
  return call<ExportReadiness>(`/reports/${reportId}/export/readiness`);
}

export function fetchExportHistory(
  reportId: string,
): Promise<{ entries: ExportHistoryEntry[] }> {
  return call<{ entries: ExportHistoryEntry[] }>(
    `/reports/${reportId}/export/history`,
  );
}

export interface CoverUpdate {
  mode?: CoverMode;
  title?: string | null;
  subtitle?: string | null;
  logoUrl?: string | null;
  uploadedFileId?: string | null;
}

export function updateExportCover(
  reportId: string,
  patch: CoverUpdate,
): Promise<{ ok: boolean }> {
  return call<{ ok: boolean }>(`/reports/${reportId}/export/cover`, {
    method: "POST",
    body: JSON.stringify(patch),
  });
}

export interface GenerateExportResponse {
  exportId: string;
  format: "pdf" | "word";
  filename: string;
  mimeType: string;
  fileSize: number;
  watermark: boolean;
  downloadUrl: string;
}

export function generateExport(
  reportId: string,
  format: "pdf" | "word",
): Promise<GenerateExportResponse> {
  return call<GenerateExportResponse>(
    `/reports/${reportId}/export/${format}`,
    { method: "POST" },
  );
}

/** Resolve a short-lived signed URL via the existing `/api/exports/{id}/download` endpoint. */
export async function fetchExportDownloadUrl(
  exportId: string,
): Promise<{ downloadUrl: string; filename: string; mimeType: string; watermark: boolean }> {
  return call<{ downloadUrl: string; filename: string; mimeType: string; watermark: boolean }>(
    `/exports/${exportId}/download`,
  );
}

// ---------------------------------------------------------------------------
// Phase 7 additions — package export, project state badge, cover upload
// ---------------------------------------------------------------------------

export interface GeneratePackageResponse {
  packageId: string;
  primaryExportId: string;
  appendixIds: string[];
  filename: string;
  watermark: boolean;
}

export function generateExportPackage(
  reportId: string,
  options: ExportPackageOptions,
): Promise<GeneratePackageResponse> {
  return call<GeneratePackageResponse>(`/reports/${reportId}/export/package`, {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export function fetchProjectExportState(
  reportId: string,
): Promise<{ state: ProjectExportState; isDemo: boolean; isPaid: boolean }> {
  return call<{ state: ProjectExportState; isDemo: boolean; isPaid: boolean }>(
    `/reports/${reportId}/export/state`,
  );
}

/**
 * Upload a cover-sheet asset (PDF or image) using the project's two-step
 * upload flow:
 *   1. POST /projects/:id/files/upload — registers metadata, returns a signed
 *      upload URL pointed at the `cover-sheets` bucket.
 *   2. PUT  <uploadUrl>                 — streams the file bytes to Supabase
 *      Storage at the resolved path.
 *
 * Returns the new `project_files.id`. The caller is expected to persist the
 * id via `updateExportCover({ uploadedFileId, mode: "uploaded" })`.
 */
export async function uploadCoverFile(args: {
  projectId: string;
  file: File;
}): Promise<{ fileId: string }> {
  const meta = await call<{
    fileId: string;
    uploadUrl?: string | null;
    storageBucket: string;
    storagePath: string;
  }>(`/projects/${args.projectId}/files/upload`, {
    method: "POST",
    body: JSON.stringify({
      originalFilename: args.file.name,
      mimeType: args.file.type || "application/octet-stream",
      fileSize: args.file.size,
      storageBucket: "cover-sheets",
    }),
  });
  if (meta.uploadUrl) {
    const put = await fetch(meta.uploadUrl, {
      method: "PUT",
      body: args.file,
      headers: { "Content-Type": args.file.type || "application/octet-stream" },
    });
    if (!put.ok) {
      throw new Error(`Cover upload failed (${put.status} ${put.statusText})`);
    }
  }
  return { fileId: meta.fileId };
}
