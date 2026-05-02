/**
 * Supabase admin client — server-side only.
 *
 * This module lazily initialises the Supabase client so the server can start
 * without Supabase credentials configured. When credentials are missing, the
 * client is null and any route that calls getSupabaseAdmin() will receive a
 * clear error rather than a crash at startup.
 *
 * IMPORTANT: NEVER import this module in frontend/browser code.
 * The service role key bypasses all RLS policies.
 *
 * Setup:
 *   1. Create a project at https://supabase.com
 *   2. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Replit Secrets
 *   3. The server will auto-detect them on next restart
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _supabaseAdmin: SupabaseClient | null = null;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  logger.warn(
    "Supabase environment variables not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). " +
    "Auth middleware and Storage signed URLs will be unavailable until configured. " +
    "See docs/replit-setup-notes.md for setup instructions.",
  );
} else {
  _supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  logger.info("Supabase admin client initialised");
}

/**
 * Returns the Supabase admin client, or null if not configured.
 * Callers should handle the null case and return 503 if the feature requires Supabase.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  return _supabaseAdmin;
}

/**
 * Returns the Supabase admin client. Throws if not configured.
 * Use in routes where Supabase is strictly required (e.g. Auth token verification).
 */
export function requireSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Replit Secrets.",
    );
  }
  return _supabaseAdmin;
}

export const supabaseAdmin = _supabaseAdmin;
