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
