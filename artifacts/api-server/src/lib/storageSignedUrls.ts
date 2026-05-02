/**
 * Supabase Storage signed URL helpers.
 *
 * Centralises signed-URL generation so individual route handlers stay short
 * and so the not-configured branch is consistent everywhere. When Supabase
 * is not configured the helpers return null and the caller is responsible
 * for returning a 503 with an actionable error message.
 */

import { getSupabaseAdmin } from "./supabase.js";
import { logger } from "./logger.js";

export interface SignedUploadUrl {
  uploadUrl: string;
  token: string;
  path: string;
}

export interface SignedDownloadUrl {
  downloadUrl: string;
  expiresInSeconds: number;
}

/**
 * Create a signed upload URL for a one-shot PUT to Supabase Storage.
 * Returns null when Supabase is not configured.
 */
export async function createSignedUploadUrl(
  bucket: string,
  path: string,
): Promise<SignedUploadUrl | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data?.signedUrl) {
    logger.warn(
      { bucket, path, err: error?.message },
      "Failed to create Supabase signed upload URL",
    );
    return null;
  }

  return {
    uploadUrl: data.signedUrl,
    token: data.token,
    path: data.path,
  };
}

/**
 * Create a signed download URL valid for `expiresInSeconds` (default 1 hour).
 * Returns null when Supabase is not configured or the underlying call fails.
 */
export async function createSignedDownloadUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number = 3600,
): Promise<SignedDownloadUrl | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    logger.warn(
      { bucket, path, err: error?.message },
      "Failed to create Supabase signed download URL",
    );
    return null;
  }

  return { downloadUrl: data.signedUrl, expiresInSeconds };
}

export const STORAGE_NOT_CONFIGURED_MESSAGE =
  "Fillagring är inte konfigurerad. Sätt SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY i Replit Secrets och kör `pnpm --filter @workspace/scripts run setup-storage-buckets`.";
