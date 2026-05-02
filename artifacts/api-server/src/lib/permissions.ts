/**
 * Role-based capability matrix for the Årsredovisningar workspace.
 *
 * Roles (matches `report_role` enum):
 *   - owner       — full control, can add/remove collaborators, change roles
 *   - admin       — like owner but cannot remove the owner
 *   - accountant  — can edit data, run validation, comment, dismiss warnings
 *   - reviewer    — can comment, change section review state, dismiss low-risk
 *   - auditor     — read-only + comment (audit trail focus)
 *   - read_only   — view only
 *
 * `can(role, action)` is the single source of truth used by every route handler.
 * Hidden-button-only security is NOT acceptable; the server must always re-check.
 */

export type ReportRole =
  | "owner"
  | "admin"
  | "accountant"
  | "reviewer"
  | "auditor"
  | "read_only";

export type Capability =
  | "edit_data"
  | "manage_users"
  | "run_validation"
  | "dismiss_warning"
  | "comment"
  | "mark_reviewed"
  | "approve_section"
  | "view_only"
  | "create_snapshot";

const MATRIX: Record<ReportRole, ReadonlySet<Capability>> = {
  owner: new Set([
    "edit_data",
    "manage_users",
    "run_validation",
    "dismiss_warning",
    "comment",
    "mark_reviewed",
    "approve_section",
    "view_only",
    "create_snapshot",
  ]),
  admin: new Set([
    "edit_data",
    "manage_users",
    "run_validation",
    "dismiss_warning",
    "comment",
    "mark_reviewed",
    "approve_section",
    "view_only",
    "create_snapshot",
  ]),
  accountant: new Set([
    "edit_data",
    "run_validation",
    "dismiss_warning",
    "comment",
    "mark_reviewed",
    "view_only",
    "create_snapshot",
  ]),
  reviewer: new Set([
    "run_validation",
    "dismiss_warning",
    "comment",
    "mark_reviewed",
    "approve_section",
    "view_only",
  ]),
  auditor: new Set(["comment", "view_only"]),
  read_only: new Set(["view_only"]),
};

export function can(role: ReportRole, action: Capability): boolean {
  return MATRIX[role]?.has(action) ?? false;
}

/**
 * Resolve the role of `profileId` for `reportId`. The report owner (i.e. the
 * profile that owns the report's company) is always treated as `owner`.
 * Otherwise we look up `report_collaborators`.
 */
export interface ResolveRoleArgs {
  ownerProfileId: string;
  collaboratorRole: ReportRole | null;
  callerProfileId: string;
}

export function resolveEffectiveRole({
  ownerProfileId,
  collaboratorRole,
  callerProfileId,
}: ResolveRoleArgs): ReportRole | null {
  if (callerProfileId === ownerProfileId) return "owner";
  return collaboratorRole;
}
