import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";

/**
 * syncProfile — runs after requireAuth.
 * Looks up or creates a profile row for the authenticated Supabase user.
 * Sets req.profile so downstream handlers can use req.profile.id for user-scoped queries.
 */
export async function syncProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next();
    return;
  }

  const authId = req.user.id;
  const email = req.user.email ?? "";

  const [existing] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.authId, authId));

  if (existing) {
    req.profile = existing;
    next();
    return;
  }

  const [created] = await db
    .insert(profilesTable)
    .values({
      authId,
      email,
      displayName: email.split("@")[0] ?? email,
      role: "owner",
    })
    .returning();

  req.profile = created;
  next();
}
