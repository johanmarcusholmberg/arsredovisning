/**
 * Project-access middleware.
 *
 * Wraps the per-project permission helpers so route handlers don't have to
 * repeat the boilerplate. Returns 404 (never 403) for both "missing project"
 * and "no access" so the API never leaks the existence of other tenants'
 * projects to an unauthorized caller.
 *
 * Usage:
 *   router.get(
 *     "/projects/:projectId/foo",
 *     requireProjectAccess("view"),
 *     async (req, res) => { ... req.projectRole ... },
 *   );
 *
 * Levels:
 *   "view"   — any role on the project (viewer, accountant, owner)
 *   "edit"   — accountant or owner
 *   "manage" — owner only (member management)
 */

import { Request, Response, NextFunction } from "express";
import {
  getUserProjectRole,
  type ProjectRole,
} from "../helpers/permissions.js";

export type ProjectAccessLevel = "view" | "edit" | "manage";

function roleSatisfies(role: ProjectRole, level: ProjectAccessLevel): boolean {
  if (level === "view") return true;
  if (level === "edit") return role === "owner" || role === "accountant";
  if (level === "manage") return role === "owner";
  return false;
}

export function requireProjectAccess(level: ProjectAccessLevel) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    const projectIdParam = req.params["projectId"];
    const projectId = Array.isArray(projectIdParam) ? projectIdParam[0] : projectIdParam;
    const profileId = req.profile?.id ?? req.user?.profileId;

    if (!profileId) {
      res.status(401).json({ error: "unauthorized", message: "Authentication required" });
      return;
    }

    if (!projectId) {
      res.status(400).json({ error: "invalid_request", message: "projectId param missing" });
      return;
    }

    const role = await getUserProjectRole(profileId, projectId);
    if (!role || !roleSatisfies(role, level)) {
      // 404, not 403, to avoid disclosing project existence across tenants.
      req.log?.warn(
        { profileId, projectId, level, role },
        "Project access denied",
      );
      res.status(404).json({ error: "not_found", message: "Project not found" });
      return;
    }

    req.projectRole = role;
    next();
  };
}
