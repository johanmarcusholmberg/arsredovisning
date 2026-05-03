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

/**
 * Hard-coded list of emails that should always be site-wide admins.
 * Compared case-insensitively. Applied in two places:
 *   1. New profile creation: row is inserted with is_admin = true.
 *   2. Existing profile sign-in: if is_admin is currently false, it is
 *      flipped to true (idempotent self-healing). This guarantees that
 *      these users have admin access regardless of past DB state.
 * To remove a user from this list, delete them here AND demote them via
 * POST /admin/users/:profileId/set-admin (the next sign-in won't re-promote).
 */
const BOOTSTRAP_ADMIN_EMAILS = new Set<string>([
  "johanmarcusholmberg@gmail.com",
]);

function isBootstrapAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return BOOTSTRAP_ADMIN_EMAILS.has(email.toLowerCase());
}

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
    .select({ id: profilesTable.id, isAdmin: profilesTable.isAdmin })
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
      })
      .returning({ id: profilesTable.id, isAdmin: profilesTable.isAdmin });
    profile = created;
    req.log.info(
      { authId, email: userEmail, isAdmin: shouldBeAdmin },
      "Auto-created profile for new user",
    );
  } else if (shouldBeAdmin && !profile.isAdmin) {
    // Self-healing promotion: a bootstrap-admin email signed in but their
    // existing profile row was not flagged as admin. Flip it now so they
    // get the access they're entitled to without manual DB intervention.
    const [updated] = await db
      .update(profilesTable)
      .set({ isAdmin: true, updatedAt: new Date() })
      .where(eq(profilesTable.id, profile.id))
      .returning({ id: profilesTable.id, isAdmin: profilesTable.isAdmin });
    profile = updated;
    req.log.info(
      { profileId: profile.id, email: userEmail },
      "Promoted bootstrap-admin email to is_admin=true",
    );
  }

  req.user = {
    ...data.user,
    profileId: profile.id,
  };

  next();
}
