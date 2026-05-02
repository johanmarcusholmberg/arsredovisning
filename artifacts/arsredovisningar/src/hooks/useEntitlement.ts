import { useGetEntitlement } from "@workspace/api-client-react";

export interface Entitlement {
  tier: "demo_only" | "paid" | "subscription";
  canCreateCompany: boolean;
  canCreateProject: boolean;
  companyCount: number;
}

/**
 * useEntitlement — returns the current user's access tier.
 *
 * Phase 2: all authenticated users receive tier "paid".
 * Stripe-gated entitlement (per-report) is wired in Phase 4.
 */
export function useEntitlement() {
  const { data, isLoading, isError } = useGetEntitlement();

  return {
    entitlement: data as Entitlement | undefined,
    isLoading,
    isError,
    isPaid: !isLoading && !isError && (data?.tier === "paid" || data?.tier === "subscription"),
    canCreateCompany: data?.canCreateCompany ?? false,
    canCreateProject: data?.canCreateProject ?? false,
  };
}
