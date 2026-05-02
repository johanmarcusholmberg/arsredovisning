import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, companiesTable } from "@workspace/db";

const router: IRouter = Router();

/**
 * GET /entitlement — return the current user's entitlement tier.
 *
 * Phase 2: All authenticated users receive "paid" entitlement.
 * Stripe-gated entitlement (per-report payment) is wired in Phase 4.
 */
router.get("/entitlement", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const [{ count: companyCount }] = await db
    .select({ count: count() })
    .from(companiesTable)
    .where(eq(companiesTable.createdByProfileId, profileId));

  res.json({
    tier: "paid",
    canCreateCompany: true,
    canCreateProject: true,
    companyCount: Number(companyCount),
    // STRIPE_REQUIRED: replace tier logic with Stripe entitlement check in Phase 4
  });
});

export default router;
