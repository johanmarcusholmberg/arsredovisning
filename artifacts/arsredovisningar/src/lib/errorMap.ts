import type { StringKey } from "@/i18n/strings";
import { mapAuthErrorToKey } from "@/i18n/strings";

/**
 * Generic API/Supabase error → translation key mapper (P3-2).
 *
 * Centralises the patterns we already match in `mapAuthErrorToKey` and
 * extends them to cover storage and RPC errors that the workspace pages
 * surface. Anything we don't recognise falls through to the generic
 * `auth.error.generic` key so the toast always speaks the user's
 * language, never raw English from Supabase.
 *
 * Accepts:
 *   - `Error` instances (uses `.message`)
 *   - plain strings
 *   - objects with `message` / `error_description` / `error` fields
 *   - unknown — returns the generic key
 */
export function mapApiErrorToKey(err: unknown): StringKey {
  const message = extractMessage(err);
  if (!message) return "auth.error.generic";

  const m = message.toLowerCase();

  // Storage-specific (Supabase storage) — keep generic for now; if we add
  // more granular keys later, slot them in here.
  if (
    m.includes("storage") &&
    (m.includes("denied") || m.includes("forbidden"))
  ) {
    return "auth.error.generic";
  }

  // Network failures
  if (
    m.includes("failed to fetch") ||
    m.includes("network error") ||
    m.includes("networkerror")
  ) {
    return "auth.error.generic";
  }

  // Fall back to the auth-message matcher; unrecognised messages there
  // also return the generic key.
  return mapAuthErrorToKey(message);
}

function extractMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (typeof o.error_description === "string") return o.error_description;
    if (typeof o.error === "string") return o.error;
  }
  return String(err);
}
