import { useGetEntitlement } from "@workspace/api-client-react";

export type EntitlementTier = "free" | "paid" | "admin";

export interface Entitlement {
  tier: EntitlementTier;
  isAdmin: boolean;
  availableProjectCredits: number;
  paidProjectIds: string[];
  canCreateCompany: boolean;
  canCreateProject: boolean;
  companyCount: number;
}

/**
 * useEntitlement — exposes the current user's access tier and capabilities.
 *
 * Tiers (from the server):
 *   - "free":  no active project entitlement and no project credits.
 *              The UI must redirect away from create-flows and the project
 *              workspace, and present /upgrade messaging instead.
 *   - "paid":  has at least one active paid entitlement OR unredeemed credits.
 *              Allowed into the real workspace.
 *   - "admin": site administrator. Bypasses all gates and sees /admin links.
 *
 * Helpers:
 *   - canEnterRealWorkspace — gate for /reports/* and /companies/* pages
 *     where the user must already be paid OR have credits.
 *   - canAccessProject(projectId) — true if the project is one the user
 *     has actively paid for, or if the user is admin.
 */
export function useEntitlement() {
  const { data, isLoading, isError, refetch } = useGetEntitlement();

  const entitlement = data as Entitlement | undefined;
  const tier = entitlement?.tier ?? "free";
  const isAdmin = entitlement?.isAdmin ?? false;
  const isPaid = tier === "paid" || tier === "admin";
  const paidProjectIds = entitlement?.paidProjectIds ?? [];

  return {
    entitlement,
    isLoading,
    isError,
    refetch,
    tier,
    isAdmin,
    isPaid,
    isFree: !isLoading && !isError && tier === "free",
    canCreateCompany: entitlement?.canCreateCompany ?? false,
    canCreateProject: entitlement?.canCreateProject ?? false,
    availableProjectCredits: entitlement?.availableProjectCredits ?? 0,
    canEnterRealWorkspace: isPaid,
    canAccessProject: (projectId: string) =>
      isAdmin || paidProjectIds.includes(projectId),
  };
}
