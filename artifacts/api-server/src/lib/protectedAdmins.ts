/**
 * Protected admin emails — single source of truth.
 *
 * Used by:
 *   - middlewares/auth.ts: auto-promotes these emails to is_admin=true on
 *     sign-in and force-unblocks them so they can never be locked out.
 *   - routes/admin.ts: refuses any admin-frontend attempt to demote, block,
 *     or (when implemented) delete a protected account.
 *
 * Comparison is case-insensitive. The list is intentionally code-resident
 * (not env-driven) so a misconfigured env var can never empty it.
 */
export const PROTECTED_ADMIN_EMAILS: ReadonlySet<string> = new Set([
  "johanmarcusholmberg@gmail.com",
]);

export function isProtectedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return PROTECTED_ADMIN_EMAILS.has(email.toLowerCase());
}
