/**
 * Demo project helpers — server-side only.
 *
 * Demo projects are sandboxed environments that let unauthenticated or
 * unpaid users explore the application. Rules:
 *
 * 1. Demo projects NEVER write to production storage buckets.
 *    All uploads go to the "demo-assets" bucket.
 * 2. All exports from demo projects are ALWAYS watermarked, regardless of
 *    any entitlement check.
 * 3. Demo data does NOT count toward a user's project quota.
 * 4. Demo projects are identified by:
 *    a) The DEMO_PROJECT_ID constant (primary shared demo project)
 *    b) The is_demo column on annual_report_projects rows (future user sandboxes)
 *
 * Source of truth for demo identity is the is_demo DB column OR the
 * DEMO_PROJECT_ID constant. NEVER use project.status as a demo signal —
 * "archived" status is a lifecycle state for real projects, not a demo indicator.
 *
 * NEVER import this module in frontend/browser code.
 */

import { eq } from "drizzle-orm";
import { db, annualReportProjectsTable } from "@workspace/db";
import { logger } from "../lib/logger.js";

// ---------------------------------------------------------------------------
// Demo project identity
// ---------------------------------------------------------------------------

/**
 * The well-known UUID for the shared demo project.
 * This is a fixed seed value — do not change it once set.
 * All demo interactions reference this project ID.
 *
 * The matching row is inserted by `pnpm --filter @workspace/scripts run seed-demo-project`.
 * Run that script after every deploy / fresh database so the demo workspace
 * is guaranteed to exist. Use `assertDemoProjectExists()` below to verify it
 * at runtime and fail fast (with a clear message) if the seed is missing.
 */
export const DEMO_PROJECT_ID = "00000000-0000-0000-0000-000000000001";

/**
 * The storage bucket used exclusively for demo file uploads.
 * Demo files never reach the private import-files bucket.
 */
export const DEMO_STORAGE_BUCKET = "demo-assets";

/**
 * The storage buckets that are off-limits for demo projects.
 * Uploads from demo projects to these buckets are rejected.
 */
export const PRODUCTION_BUCKETS = [
  "import-files",
  "previous-annual-reports",
  "cover-sheets",
  "exports",
] as const;

// ---------------------------------------------------------------------------
// Demo detection helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the given projectId matches the hard-coded demo project UUID.
 * Use for constant-time checks where no DB round-trip is acceptable.
 */
export function isKnownDemoProjectId(projectId: string): boolean {
  return projectId === DEMO_PROJECT_ID;
}

/**
 * Returns true if the project is a demo project.
 *
 * Source of truth (in priority order):
 *   1. Hard-coded DEMO_PROJECT_ID — always demo, no DB query needed.
 *   2. annual_report_projects.is_demo column — true for user-created demo sandboxes.
 *
 * This function NEVER uses project.status as a demo signal. "archived" is a
 * lifecycle state for real annual reports and must not weaken entitlement checks.
 *
 * Returns false (not demo) if the project does not exist in the DB.
 */
export async function isDemoProject(projectId: string): Promise<boolean> {
  if (isKnownDemoProjectId(projectId)) return true;

  const [project] = await db
    .select({ isDemo: annualReportProjectsTable.isDemo })
    .from(annualReportProjectsTable)
    .where(eq(annualReportProjectsTable.id, projectId))
    .limit(1);

  if (!project) return false;

  return project.isDemo === true;
}

// ---------------------------------------------------------------------------
// Storage path helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the storage bucket for a file upload.
 * Demo projects (identified by DEMO_PROJECT_ID or is_demo flag) always
 * use DEMO_STORAGE_BUCKET — they cannot write to production buckets.
 *
 * @param isDemo - result of isDemoProject() for this project
 * @param requestedBucket - the bucket the caller would like to use
 */
export function resolveUploadBucket(
  isDemo: boolean,
  requestedBucket: string,
): string {
  if (isDemo) {
    return DEMO_STORAGE_BUCKET;
  }
  if ((PRODUCTION_BUCKETS as readonly string[]).includes(requestedBucket)) {
    return requestedBucket;
  }
  return "import-files";
}

/**
 * Build a canonical storage path for a file within a bucket.
 * Convention: {projectId}/{fileId}/{originalFilename}
 *
 * This ensures files are namespaced by project and never collide across projects.
 */
export function buildStoragePath(
  projectId: string,
  fileId: string,
  originalFilename: string,
): string {
  const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${projectId}/${fileId}/${safeName}`;
}

// ---------------------------------------------------------------------------
// Export watermark enforcement
// ---------------------------------------------------------------------------

/**
 * Returns true if an export for this project must be watermarked.
 * Demo projects are ALWAYS watermarked regardless of payment status.
 * Real unpaid projects are also watermarked.
 *
 * @param isDemo - result of isDemoProject() for this project
 * @param isPaid - result of hasPaidProjectEntitlement() for this project
 */
export function mustWatermark(isDemo: boolean, isPaid: boolean): boolean {
  if (isDemo) return true;
  return !isPaid;
}

// ---------------------------------------------------------------------------
// Demo seed verification
// ---------------------------------------------------------------------------

/**
 * Verifies that the shared demo project row exists in the database.
 *
 * The Årsredovisningar app references DEMO_PROJECT_ID from many places
 * (entitlement gate, cover-sheet renderer, export readiness, etc.). If the
 * row is missing — for example, on a fresh deploy where `seed-demo-project`
 * was forgotten — those callsites would hit hard-to-diagnose 500s.
 *
 * This helper lets callers fail gracefully with a clear, actionable message:
 *
 *   const ok = await ensureDemoSeedExists();
 *   if (!ok) return res.status(503).json({
 *     error: "demo_unavailable",
 *     message: "Demo workspace not initialised. Contact support.",
 *   });
 *
 * The result is cached for the lifetime of the process to avoid one DB
 * round-trip per demo request once seeded. We never cache a negative result
 * — that way, running the seed script and hitting refresh starts working
 * immediately without restarting the server.
 */
let demoSeedConfirmed = false;

export async function ensureDemoSeedExists(): Promise<boolean> {
  if (demoSeedConfirmed) return true;

  const [row] = await db
    .select({ id: annualReportProjectsTable.id })
    .from(annualReportProjectsTable)
    .where(eq(annualReportProjectsTable.id, DEMO_PROJECT_ID))
    .limit(1);

  if (row) {
    demoSeedConfirmed = true;
    return true;
  }

  logger.warn(
    { demoProjectId: DEMO_PROJECT_ID },
    "Demo project row is missing. Run `pnpm --filter @workspace/scripts run seed-demo-project` to create it.",
  );
  return false;
}

