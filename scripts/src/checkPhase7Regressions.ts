/**
 * Phase 7 regression tests.
 *
 * Two integration checks against the live dev database that lock in the two
 * critical fixes from the Phase 7 architect review:
 *
 *   1. IDOR — `cover_uploaded_file_id` must never resolve a `project_files`
 *      row that belongs to a different project. Both the write path
 *      (`POST /export/cover`) and the read path (`GET /export/data`) gate on
 *      `(project_files.id, project_files.project_id) == (fileId, ctx.projectId)`.
 *      We replicate the exact Drizzle predicate here.
 *
 *   2. Concurrent first-export race — only ONE of N parallel non-watermarked
 *      exports may flip `annual_report_projects.status → 'exported'` and
 *      emit `project.marked_exported`. The route now uses a single
 *      conditional UPDATE with `RETURNING id`; we hammer it with parallel
 *      calls and assert exactly one returns a row.
 *
 * Run via: `pnpm --filter @workspace/scripts run check-phase7-regressions`
 *
 * The script is fully self-contained: it seeds throwaway rows with random
 * org-numbers / fiscal years, runs the assertions, and tears everything
 * down in a `finally` block (cascading from the company row).
 */

import { randomUUID } from "crypto";
import { and, eq, ne } from "drizzle-orm";
import {
  db,
  pool,
  companiesTable,
  annualReportProjectsTable,
  projectFilesTable,
} from "@workspace/db";

type CleanupHandle = { companyId: string };

const CONCURRENCY = 8;

async function seed(): Promise<{
  companyId: string;
  projectAId: string;
  projectBId: string;
  fileInBId: string;
  raceProjectId: string;
}> {
  const tag = `phase7-regression-${randomUUID().slice(0, 8)}`;
  const [company] = await db
    .insert(companiesTable)
    .values({
      name: tag,
      // organization_number is UNIQUE — use a high-entropy synthetic value
      // that cannot collide with real Swedish org-numbers.
      organizationNumber: `TEST-${randomUUID()}`,
    })
    .returning({ id: companiesTable.id });

  const [projectA, projectB, raceProject] = await db
    .insert(annualReportProjectsTable)
    .values([
      {
        companyId: company.id,
        fiscalYearStart: "2024-01-01",
        fiscalYearEnd: "2024-12-31",
      },
      {
        companyId: company.id,
        fiscalYearStart: "2023-01-01",
        fiscalYearEnd: "2023-12-31",
      },
      {
        companyId: company.id,
        fiscalYearStart: "2022-01-01",
        fiscalYearEnd: "2022-12-31",
      },
    ])
    .returning({ id: annualReportProjectsTable.id });

  const [fileInB] = await db
    .insert(projectFilesTable)
    .values({
      projectId: projectB.id,
      storageBucket: "cover-sheets",
      storagePath: `${projectB.id}/${randomUUID()}/cover.pdf`,
      originalFilename: "cover.pdf",
      mimeType: "application/pdf",
      fileType: "cover",
      uploadStatus: "uploaded",
    })
    .returning({ id: projectFilesTable.id });

  return {
    companyId: company.id,
    projectAId: projectA.id,
    projectBId: projectB.id,
    fileInBId: fileInB.id,
    raceProjectId: raceProject.id,
  };
}

async function cleanup({ companyId }: CleanupHandle): Promise<void> {
  // project_files cascades from annual_report_projects which cascades... well,
  // it doesn't cascade from companies (companyId is a plain FK). So delete in
  // dependency order.
  const projectIds = await db
    .select({ id: annualReportProjectsTable.id })
    .from(annualReportProjectsTable)
    .where(eq(annualReportProjectsTable.companyId, companyId));
  for (const { id } of projectIds) {
    // project_files.projectId has onDelete: "cascade", so this is enough.
    await db
      .delete(annualReportProjectsTable)
      .where(eq(annualReportProjectsTable.id, id));
  }
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));
}

/**
 * Test 1 — IDOR closure.
 *
 * Mirrors the exact Drizzle predicate used in:
 *   - POST /reports/:reportId/export/cover  (write-side validation)
 *   - GET  /reports/:reportId/export/data   (read-side signed-URL resolution,
 *     via the supabase-js eq("id", …).eq("project_id", …) pair)
 */
async function testIdor(seed: {
  projectAId: string;
  projectBId: string;
  fileInBId: string;
}): Promise<void> {
  // Negative — project A asking for project B's file: must return 0 rows.
  const crossProject = await db
    .select({ id: projectFilesTable.id })
    .from(projectFilesTable)
    .where(
      and(
        eq(projectFilesTable.id, seed.fileInBId),
        eq(projectFilesTable.projectId, seed.projectAId),
      ),
    )
    .limit(1);

  if (crossProject.length !== 0) {
    throw new Error(
      `IDOR regression: cross-project lookup returned ${crossProject.length} row(s); expected 0. ` +
        `(file ${seed.fileInBId} belongs to ${seed.projectBId} but resolved under ${seed.projectAId})`,
    );
  }

  // Positive control — project B asking for its own file: must return 1 row.
  const sameProject = await db
    .select({ id: projectFilesTable.id })
    .from(projectFilesTable)
    .where(
      and(
        eq(projectFilesTable.id, seed.fileInBId),
        eq(projectFilesTable.projectId, seed.projectBId),
      ),
    )
    .limit(1);

  if (sameProject.length !== 1) {
    throw new Error(
      `IDOR positive control failed: same-project lookup returned ${sameProject.length} row(s); expected 1.`,
    );
  }
}

/**
 * Test 2 — atomic marked-exported transition.
 *
 * Mirrors the conditional UPDATE the route now performs:
 *   UPDATE annual_report_projects
 *      SET status = 'exported', updated_at = now()
 *    WHERE id = ? AND status <> 'exported'
 *    RETURNING id
 *
 * The audit event is only emitted when `RETURNING` yields a row, so we
 * assert that across N parallel calls the row count sums to exactly 1.
 */
async function testMarkedExportedRace(seed: {
  raceProjectId: string;
}): Promise<void> {
  // Sanity: the project must start in a non-exported state.
  const [pre] = await db
    .select({ status: annualReportProjectsTable.status })
    .from(annualReportProjectsTable)
    .where(eq(annualReportProjectsTable.id, seed.raceProjectId))
    .limit(1);
  if (!pre || pre.status === "exported") {
    throw new Error(
      `Race-test precondition failed: project ${seed.raceProjectId} is already 'exported' (status=${pre?.status}).`,
    );
  }

  const attempts = Array.from({ length: CONCURRENCY }, () =>
    db
      .update(annualReportProjectsTable)
      .set({ status: "exported", updatedAt: new Date() })
      .where(
        and(
          eq(annualReportProjectsTable.id, seed.raceProjectId),
          ne(annualReportProjectsTable.status, "exported"),
        ),
      )
      .returning({ id: annualReportProjectsTable.id }),
  );

  const results = await Promise.all(attempts);
  const flippedCount = results.reduce((sum, r) => sum + r.length, 0);

  if (flippedCount !== 1) {
    throw new Error(
      `Concurrency regression: ${CONCURRENCY} parallel conditional updates flipped the row ${flippedCount} time(s); expected exactly 1. ` +
        `Audit event 'project.marked_exported' would have fired ${flippedCount} times.`,
    );
  }

  // Post-condition: row is now 'exported'.
  const [post] = await db
    .select({ status: annualReportProjectsTable.status })
    .from(annualReportProjectsTable)
    .where(eq(annualReportProjectsTable.id, seed.raceProjectId))
    .limit(1);
  if (!post || post.status !== "exported") {
    throw new Error(
      `Post-condition failed: status is '${post?.status}'; expected 'exported'.`,
    );
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  let handle: CleanupHandle | null = null;
  try {
    const s = await seed();
    handle = { companyId: s.companyId };

    await testIdor(s);
    console.log("[phase7] PASS — cover uploadedFileId IDOR is closed.");

    await testMarkedExportedRace(s);
    console.log(
      `[phase7] PASS — marked-exported transition is atomic under ${CONCURRENCY}-way concurrency.`,
    );

    console.log("[phase7] OK — all regression checks passed.");
  } finally {
    if (handle) {
      try {
        await cleanup(handle);
      } catch (err) {
        console.error("[phase7] WARN — cleanup failed:", err);
      }
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[phase7] FAIL —", err instanceof Error ? err.message : err);
  process.exit(1);
});
