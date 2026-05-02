/**
 * /me routes — current authenticated user's profile, preferences, and security.
 *
 * Auth model:
 *   - All routes are mounted behind requireAuth + syncProfile, so req.user and
 *     req.profile are guaranteed populated.
 *   - Password and email changes use the Supabase admin client (service role),
 *     scoped to req.user.id (the Supabase Auth UID).
 *   - Password changes re-verify the current password by attempting a sign-in
 *     against Supabase using a transient public client.
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { db, profilesTable, userPreferencesTable, type Profile, type UserPreferences } from "@workspace/db";
import {
  UpdateMyProfileBody,
  UpdateMyPreferencesBody,
  ChangeMyPasswordBody,
  ChangeMyEmailBody,
} from "@workspace/api-zod";
import { requireSupabaseAdmin } from "../lib/supabase.js";

const router: IRouter = Router();

function toMeResponse(profile: Profile, prefs: UserPreferences) {
  return {
    profile: {
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      defaultUiLanguage: (profile.defaultUiLanguage === "en" ? "en" : "sv") as "sv" | "en",
      role: profile.role,
    },
    preferences: {
      emailWeeklySummary: prefs.emailWeeklySummary,
      deadlineAlertsEnabled: prefs.deadlineAlertsEnabled,
    },
  };
}

async function loadOrCreatePreferences(profileId: string): Promise<UserPreferences> {
  const [existing] = await db
    .select()
    .from(userPreferencesTable)
    .where(eq(userPreferencesTable.profileId, profileId));

  if (existing) return existing;

  const [created] = await db
    .insert(userPreferencesTable)
    .values({ profileId })
    .returning();
  return created;
}

router.get("/me", async (req, res): Promise<void> => {
  const profile = req.profile;
  if (!profile) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const prefs = await loadOrCreatePreferences(profile.id);
  res.json(toMeResponse(profile, prefs));
});

router.patch("/me/profile", async (req, res): Promise<void> => {
  const profile = req.profile;
  if (!profile) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", message: parsed.error.message });
    return;
  }

  const updates: Partial<Profile> = { updatedAt: new Date() };
  if (parsed.data.displayName !== undefined) {
    updates.displayName = parsed.data.displayName;
  }
  if (parsed.data.defaultUiLanguage !== undefined) {
    updates.defaultUiLanguage = parsed.data.defaultUiLanguage;
  }

  const [updated] = await db
    .update(profilesTable)
    .set(updates)
    .where(eq(profilesTable.id, profile.id))
    .returning();

  const prefs = await loadOrCreatePreferences(profile.id);
  res.json(toMeResponse(updated, prefs));
});

router.patch("/me/preferences", async (req, res): Promise<void> => {
  const profile = req.profile;
  if (!profile) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const parsed = UpdateMyPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", message: parsed.error.message });
    return;
  }

  // Ensure a row exists, then update the requested fields.
  await loadOrCreatePreferences(profile.id);

  const updates: Partial<UserPreferences> = { updatedAt: new Date() };
  if (parsed.data.emailWeeklySummary !== undefined) {
    updates.emailWeeklySummary = parsed.data.emailWeeklySummary;
  }
  if (parsed.data.deadlineAlertsEnabled !== undefined) {
    updates.deadlineAlertsEnabled = parsed.data.deadlineAlertsEnabled;
  }

  const [updatedPrefs] = await db
    .update(userPreferencesTable)
    .set(updates)
    .where(eq(userPreferencesTable.profileId, profile.id))
    .returning();

  res.json(toMeResponse(profile, updatedPrefs));
});

router.post("/me/password", async (req, res): Promise<void> => {
  const profile = req.profile;
  const authId = req.user?.id;
  const email = req.user?.email;
  if (!profile || !authId || !email) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const parsed = ChangeMyPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "invalid_input",
      message: parsed.error.message,
    });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  // Re-verify current password using a transient anon client so we don't
  // disturb the admin client's session state.
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({
      error: "service_unavailable",
      message: "Supabase anon credentials not configured (SUPABASE_URL, SUPABASE_ANON_KEY).",
    });
    return;
  }

  const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: verifyError } = await verifyClient.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) {
    req.log.info({ authId }, "Password change rejected: current password incorrect");
    res.status(401).json({
      error: "invalid_credentials",
      message: "Current password is incorrect.",
    });
    return;
  }

  const admin = requireSupabaseAdmin();
  const { error: updateError } = await admin.auth.admin.updateUserById(authId, {
    password: newPassword,
  });
  if (updateError) {
    req.log.error({ authId, err: updateError }, "Password update failed");
    res.status(400).json({
      error: "password_update_failed",
      message: updateError.message,
    });
    return;
  }

  req.log.info({ authId }, "Password changed");
  res.status(204).end();
});

router.post("/me/email", async (req, res): Promise<void> => {
  const authId = req.user?.id;
  if (!authId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const parsed = ChangeMyEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", message: parsed.error.message });
    return;
  }

  const admin = requireSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(authId, {
    email: parsed.data.newEmail,
  });
  if (error) {
    req.log.warn({ authId, err: error }, "Email change failed");
    res.status(400).json({ error: "email_update_failed", message: error.message });
    return;
  }

  req.log.info({ authId, newEmail: parsed.data.newEmail }, "Email change initiated");
  res.status(202).end();
});

export default router;
