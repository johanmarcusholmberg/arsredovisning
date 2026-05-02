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
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.authId, authId))
    .limit(1);

  if (!profile) {
    const email = data.user.email ?? "";
    const [created] = await db
      .insert(profilesTable)
      .values({
        authId,
        email,
        displayName: data.user.user_metadata?.["full_name"] ?? null,
      })
      .returning({ id: profilesTable.id });
    profile = created;
    req.log.info({ authId, email }, "Auto-created profile for new user");
  }

  req.user = {
    ...data.user,
    profileId: profile.id,
  };

  next();
}
