/**
 * Authentication middleware — Phase 2.5.
 *
 * requireAuth validates a Bearer token against Supabase Auth and attaches
 * the resolved user to req.user. If Supabase is not yet configured, the
 * middleware returns 503 Service Unavailable with a clear message.
 *
 * Once Supabase is configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set),
 * this middleware becomes fully functional without any code changes.
 *
 * req.user shape (after successful auth):
 *   req.user.id          — Supabase Auth UUID (maps to profiles.auth_id)
 *   req.user.email       — user's email address
 *   req.user.profileId   — internal profiles.id UUID (resolved from auth_id)
 *
 * Phase 3+: profileId is required for all permission helper calls.
 * If the profile row does not exist yet, it will be auto-created here.
 */

import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { isProtectedAdminEmail } from "../lib/protectedAdmins.js";

/**
 * Bootstrap-admin handling: the PROTECTED_ADMIN_EMAILS list (see
 * lib/protectedAdmins.ts) is the single source of truth for both:
 *   1. Auto-promotion to is_admin=true on first sign-in.
 *   2. Self-healing if a protected admin's row is somehow blocked or demoted.
 * The same list is used by /admin routes to refuse any frontend attempt
 * to demote, block, or delete those accounts.
 */
const isBootstrapAdminEmail = isProtectedAdminEmail;

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    res.status(503).json({
      error: "service_unavailable",
      message:
        "Authentication service is not configured. " +
        "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Replit Secrets.",
    });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
    return;
  }

  // Resolve internal profile ID from Supabase Auth UID.
  // Auto-create profile row on first login.
  const authId = data.user.id;
  let [profile] = await db
    .select({
      id: profilesTable.id,
      isAdmin: profilesTable.isAdmin,
      status: profilesTable.status,
      lastSignInAt: profilesTable.lastSignInAt,
    })
    .from(profilesTable)
    .where(eq(profilesTable.authId, authId))
    .limit(1);

  const userEmail = data.user.email ?? "";
  const shouldBeAdmin = isBootstrapAdminEmail(userEmail);

  if (!profile) {
    const [created] = await db
      .insert(profilesTable)
      .values({
        authId,
        email: userEmail,
        displayName: data.user.user_metadata?.["full_name"] ?? null,
        isAdmin: shouldBeAdmin,
        lastSignInAt: new Date(),
      })
      .returning({
        id: profilesTable.id,
        isAdmin: profilesTable.isAdmin,
        status: profilesTable.status,
        lastSignInAt: profilesTable.lastSignInAt,
      });
    profile = created;
    req.log.info(
      { authId, email: userEmail, isAdmin: shouldBeAdmin },
      "Auto-created profile for new user",
    );
  } else if (shouldBeAdmin && !profile.isAdmin) {
    // Self-healing promotion: a bootstrap-admin email signed in but their
    // existing profile row was not flagged as admin. Flip it now so they
    // get the access they're entitled to without manual DB intervention.
    // Bootstrap admins are also force-unblocked here so they can never
    // lock themselves out by toggling status in the admin UI.
    const [updated] = await db
      .update(profilesTable)
      .set({ isAdmin: true, status: "active", updatedAt: new Date() })
      .where(eq(profilesTable.id, profile.id))
      .returning({
        id: profilesTable.id,
        isAdmin: profilesTable.isAdmin,
        status: profilesTable.status,
        lastSignInAt: profilesTable.lastSignInAt,
      });
    profile = updated;
    req.log.info(
      { profileId: profile.id, email: userEmail },
      "Promoted bootstrap-admin email to is_admin=true",
    );
  } else if (shouldBeAdmin && profile.status === "blocked") {
    // Defensive: a bootstrap admin must never remain blocked.
    const [updated] = await db
      .update(profilesTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(profilesTable.id, profile.id))
      .returning({
        id: profilesTable.id,
        isAdmin: profilesTable.isAdmin,
        status: profilesTable.status,
        lastSignInAt: profilesTable.lastSignInAt,
      });
    profile = updated;
  }

  // ── Block enforcement ─────────────────────────────────────────────────
  // Once a profile is blocked, every authenticated request fails closed
  // with 403. The /admin set-status endpoint cannot block a bootstrap
  // admin, so site administrators can always recover access.
  if (profile.status === "blocked") {
    res.status(403).json({
      error: "account_blocked",
      message: "This account has been blocked. Contact support.",
    });
    return;
  }

  // ── Throttled last-sign-in update ────────────────────────────────────
  // Update at most once per minute to keep DB write volume low.
  const now = Date.now();
  const last = profile.lastSignInAt ? profile.lastSignInAt.getTime() : 0;
  if (now - last > 60_000) {
    db
      .update(profilesTable)
      .set({ lastSignInAt: new Date() })
      .where(eq(profilesTable.id, profile.id))
      .catch((err) => req.log.warn({ err }, "Failed to update lastSignInAt"));
  }

  req.user = {
    ...data.user,
    profileId: profile.id,
  };

  next();
}
