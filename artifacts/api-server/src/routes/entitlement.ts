import { Router, type IRouter } from "express";
import { getEntitlementContext } from "../helpers/permissions.js";

const router: IRouter = Router();

/**
 * GET /entitlement — return the current user's entitlement context.
 *
 * Tier semantics:
 *   - "free":  no active project entitlement and no project credits.
 *              The user is restricted to demo / account / billing routes
 *              and cannot create real companies or projects.
 *   - "paid":  has at least one paid (manual_grant / stripe_payment /
 *              subscription) entitlement on a project they can access,
 *              or has unredeemed credits to spend.
 *   - "admin": site administrator. Bypasses all entitlement gates.
 *
 * Stripe Checkout (future phase) will deposit credits via webhook;
 * until then admins grant credits manually via /admin/users/:id/grant-credits.
 */
router.get("/entitlement", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const ctx = await getEntitlementContext(profileId);
  res.json(ctx);
});

export default router;
