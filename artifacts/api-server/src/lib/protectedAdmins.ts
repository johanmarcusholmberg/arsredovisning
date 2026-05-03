/**
 * Protected admin emails — single source of truth.
 *
 * Used by:
 *   - middlewares/auth.ts: auto-promotes these emails to is_admin=true on
 *     sign-in and force-unblocks them so they can never be locked out.
 *   - routes/admin.ts: refuses any admin-frontend attempt to demote, block,
 *     or (when implemented) delete a protected account.
 *
 * Comparison is case-insensitive.
 *
 * ── Sources (merged at startup, in order) ───────────────────────────────────
 *
 *   1. CODE_PROTECTED_EMAILS — hard-coded below. Always present even if the
 *      env var is empty/misconfigured. This guarantees the founder account is
 *      never accidentally locked out.
 *
 *   2. BOOTSTRAP_ADMIN_EMAILS env var — comma- or whitespace-separated list
 *      of additional admin emails. Useful for adding ops/support staff
 *      without a code deploy. Empty / unset is safe (no extra admins).
 *
 * ── How to remove an admin ──────────────────────────────────────────────────
 *
 *   Removing admin access requires BOTH:
 *     a) Remove the email from CODE_PROTECTED_EMAILS (if listed there) AND
 *        from the BOOTSTRAP_ADMIN_EMAILS env var. Otherwise the next sign-in
 *        will auto-re-promote them via middlewares/auth.ts.
 *     b) Revoke admin in the database:
 *          UPDATE profiles SET is_admin = false WHERE email = '...';
 *        OR use POST /admin/users/:profileId/set-admin {isAdmin:false} from
 *        the admin UI — but this will fail with 403 for code-protected emails.
 *
 *   Until BOTH steps are done, the user remains an admin.
 *
 * ── Why a hard-coded floor ──────────────────────────────────────────────────
 *
 *   Pure env-driven allowlists are fragile: a typo, a missing secret in a new
 *   environment, or an accidental empty value would silently empty the list
 *   and lock everyone out of /admin. The hard-coded floor keeps recovery
 *   possible from any deployment state.
 */

const CODE_PROTECTED_EMAILS: ReadonlyArray<string> = [
  "johanmarcusholmberg@gmail.com",
];

function parseEnvList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && s.includes("@"));
}

function buildProtectedSet(): ReadonlySet<string> {
  const set = new Set<string>();
  for (const email of CODE_PROTECTED_EMAILS) {
    set.add(email.toLowerCase());
  }
  for (const email of parseEnvList(process.env["BOOTSTRAP_ADMIN_EMAILS"])) {
    set.add(email);
  }
  return set;
}

/**
 * The active set of protected admin emails for this process.
 * Resolved once at module load; restart the server to pick up env changes.
 */
export const PROTECTED_ADMIN_EMAILS: ReadonlySet<string> = buildProtectedSet();

export function isProtectedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return PROTECTED_ADMIN_EMAILS.has(email.toLowerCase());
}
