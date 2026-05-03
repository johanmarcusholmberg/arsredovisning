/**
 * gateProjectWrites — entitlement + edit-permission gate for every
 * state-changing request that targets a real project.
 *
 * Why a middleware (instead of inline checks per handler)?
 *   The arsredovisningar app exposes ~35 write endpoints under
 *   `/reports/:reportId/...` (notes, noteRows, financialStatements,
 *   reviews, collaborators, cashFlow, reclassifications, validation, …).
 *   Each one needs the same trio of checks (auth, project edit role,
 *   active paid entitlement). Centralising them here:
 *     - guarantees no future write endpoint accidentally bypasses
 *       the paid wall,
 *     - keeps the per-route handlers focused on business logic,
 *     - lets us evolve the entitlement model (Stripe later) in one place.
 *
 * Behaviour:
 *   - Method must be a write (POST / PATCH / PUT / DELETE).
 *   - Path must match `/reports/:reportId/...` OR `/projects/:projectId/...`
 *     (other than the project creation endpoint itself, which has its own
 *     credit-spend logic).
 *   - We resolve a report id to its underlying project id via
 *     resolveProjectForReport. If the report isn't tied to a project yet
 *     we fail closed: a real report without an entitlement record is not
 *     editable. Demo reports use the DEMO_PROJECT_ID and bypass the
 *     entitlement requirement (see requireProjectEdit).
 *
 * NOT covered here (intentionally):
 *   - POST /companies, POST /projects, POST /companies/:id/reports — these
 *     have their own pre-checks (canCreateRealProject) so we don't double-bill.
 *   - GET requests — read access is governed by canViewProject inline.
 *   - /admin/* and /me — handled by their own middlewares.
 */

import type { Request, Response, NextFunction } from "express";
import { requireProjectEdit } from "../helpers/permissions.js";
import { resolveProjectForReport } from "../helpers/projectReportLink.js";

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const REPORT_PATH_RE = /^\/reports\/([^/?#]+)(?:\/|$)/;
const PROJECT_PATH_RE = /^\/projects\/([^/?#]+)(?:\/|$)/;

export async function gateProjectWrites(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!WRITE_METHODS.has(req.method)) {
    next();
    return;
  }

  // Try /reports/:reportId/... first.
  const reportMatch = REPORT_PATH_RE.exec(req.path);
  if (reportMatch) {
    const reportId = reportMatch[1];
    const link = await resolveProjectForReport(reportId);
    if (!link || !link.projectId) {
      // Either the report doesn't exist or it has no annual_report_projects
      // row to attach an entitlement to. We respond 404 in BOTH cases so an
      // anonymous probe can't distinguish "report does not exist" from
      // "report exists but is orphaned" by the response code/shape. The
      // orphan branch is also fail-closed against editing without payment.
      res.status(404).json({ error: "not_found", message: "Report not found" });
      return;
    }
    const ok = await requireProjectEdit(req, res, link.projectId);
    if (!ok) return;
    next();
    return;
  }

  // /projects/:projectId/... — covers any future per-project sub-routes.
  const projectMatch = PROJECT_PATH_RE.exec(req.path);
  if (projectMatch) {
    const projectId = projectMatch[1];
    const ok = await requireProjectEdit(req, res, projectId);
    if (!ok) return;
    next();
    return;
  }

  next();
}
