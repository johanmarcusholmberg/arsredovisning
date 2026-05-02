/**
 * Permission helpers — server-side only.
 *
 * All helpers accept a userId (profile UUID from session/middleware) rather than
 * reading from a Supabase JWT directly. Once Supabase Auth is fully wired, the
 * requireAuth middleware will resolve the JWT to a profile ID and attach it.
 *
 * These helpers query the Drizzle ORM schema (project_access, project_entitlements)
 * and return boolean verdicts. They do NOT throw — callers are responsible for
 * returning 401/403 responses when helpers return false.
 *
 * NEVER import this module in frontend/browser code.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  profilesTable,
  projectAccessTable,
  projectEntitlementsTable,
  annualReportProjectsTable,
} from "@workspace/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectRole = "owner" | "accountant" | "viewer";

export interface UserProjectContext {
  profileId: string;
  projectId: string;
  role: ProjectRole | null;
}

// ---------------------------------------------------------------------------
// Low-level lookups
// ---------------------------------------------------------------------------

/**
 * Fetch the current user's profile row by their internal profile UUID.
 * Returns null if the profile does not exist.
 */
export async function getCurrentUser(profileId: string) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, profileId))
    .limit(1);
  return profile ?? null;
}

/**
 * Return the role a profile has on a specific project, or null if they have no access.
 */
export async function getUserProjectRole(
  profileId: string,
  projectId: string,
): Promise<ProjectRole | null> {
  const [access] = await db
    .select({ role: projectAccessTable.role })
    .from(projectAccessTable)
    .where(
      and(
        eq(projectAccessTable.profileId, profileId),
        eq(projectAccessTable.projectId, projectId),
      ),
    )
    .limit(1);

  if (!access) return null;
  return access.role as ProjectRole;
}

// ---------------------------------------------------------------------------
// Project permission helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the profile has any role on the project (viewer, accountant, or owner).
 */
export async function canViewProject(profileId: string, projectId: string): Promise<boolean> {
  const role = await getUserProjectRole(profileId, projectId);
  return role !== null;
}

/**
 * Returns true if the profile can edit project data (accountant or owner).
 */
export async function canEditProject(profileId: string, projectId: string): Promise<boolean> {
  const role = await getUserProjectRole(profileId, projectId);
  return role === "accountant" || role === "owner";
}

/**
 * Returns true if the profile can manage other users on the project (owner only).
 */
export async function canManageProjectUsers(
  profileId: string,
  projectId: string,
): Promise<boolean> {
  const role = await getUserProjectRole(profileId, projectId);
  return role === "owner";
}

/**
 * Returns true if the profile can upload files to the project (accountant or owner).
 */
export async function canUploadFiles(profileId: string, projectId: string): Promise<boolean> {
  return canEditProject(profileId, projectId);
}

/**
 * Returns true if the profile can trigger validation on the project (accountant or owner).
 */
export async function canRunValidation(profileId: string, projectId: string): Promise<boolean> {
  return canEditProject(profileId, projectId);
}

/**
 * Returns true if the profile can export the project (owner only).
 * Exporting is gated behind ownership to ensure the payer approves the final output.
 */
export async function canExportProject(profileId: string, projectId: string): Promise<boolean> {
  const role = await getUserProjectRole(profileId, projectId);
  return role === "owner";
}

// ---------------------------------------------------------------------------
// Entitlement helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if there is an active, non-demo, non-trial entitlement on the project.
 * Used to gate paid features (unwatermarked export, full SIE parsing, etc.).
 *
 * A project is considered "paid" if it has at least one active entitlement with type
 * "stripe_payment" or "subscription" or "manual_grant" (and validUntil is null or in the future).
 */
export async function hasPaidProjectEntitlement(projectId: string): Promise<boolean> {
  const now = new Date();
  const entitlements = await db
    .select()
    .from(projectEntitlementsTable)
    .where(
      and(
        eq(projectEntitlementsTable.projectId, projectId),
        eq(projectEntitlementsTable.isActive, true),
      ),
    );

  return entitlements.some((e) => {
    const isPaidType =
      e.entitlementType === "stripe_payment" ||
      e.entitlementType === "subscription" ||
      e.entitlementType === "manual_grant";
    const notExpired = e.validUntil === null || e.validUntil > now;
    return isPaidType && notExpired;
  });
}

/**
 * Returns true if the profile is allowed to create a new real (non-demo) project.
 * For now this is a simple check — the user must exist.
 * Phase 4 will add Stripe subscription/payment checks here.
 *
 * TODO (Phase 4): Check for an active subscription or available project credits.
 */
export async function canCreateRealProject(profileId: string): Promise<boolean> {
  const user = await getCurrentUser(profileId);
  return user !== null;
}

// ---------------------------------------------------------------------------
// Project ownership lookup
// ---------------------------------------------------------------------------

/**
 * Returns the annual_report_projects row or null if not found.
 * Used internally by routes to verify the project exists before permission checks.
 */
export async function getProject(projectId: string) {
  const [project] = await db
    .select()
    .from(annualReportProjectsTable)
    .where(eq(annualReportProjectsTable.id, projectId))
    .limit(1);
  return project ?? null;
}
