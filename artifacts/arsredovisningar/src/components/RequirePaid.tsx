import { ReactNode } from "react";
import { Redirect } from "wouter";
import { useEntitlement } from "@/hooks/useEntitlement";
import { Skeleton } from "@/components/ui/skeleton";

interface RequirePaidProps {
  children: ReactNode;
  /**
   * If provided, the gate also requires that this specific project id be in
   * the user's paid project list (or that they're admin). Use for routes
   * scoped to a single project workspace, like /reports/:reportId/notes.
   *
   * NOTE: this is a UI hint only — the API server is the source of truth.
   * Anyone who tries to bypass this client check still hits 402 from the
   * write endpoints (see middlewares/gateProjectWrites.ts).
   */
  projectId?: string;
}

/**
 * Client-side guard that redirects unpaid users to /upgrade.
 *
 * Use around:
 *   - /companies/new and /companies/:id (create / edit real companies)
 *   - /reports/:reportId/* (real report workspace)
 *
 * Free users (tier === "free") are sent to /upgrade. The /upgrade page
 * stays freely accessible so the user can land on it from a paywall and
 * understand the next step.
 */
export function RequirePaid({ children, projectId }: RequirePaidProps) {
  const { isLoading, isFree, canAccessProject, isAdmin } = useEntitlement();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isFree) return <Redirect to="/upgrade" />;

  // Per-project guard: the user is paid in general but might not be on
  // this specific project (e.g. opened a deep link to someone else's
  // project). Admins bypass.
  if (projectId && !isAdmin && !canAccessProject(projectId)) {
    return <Redirect to="/upgrade" />;
  }

  return <>{children}</>;
}
