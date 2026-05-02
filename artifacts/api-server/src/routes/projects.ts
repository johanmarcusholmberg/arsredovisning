import { Router, type IRouter } from "express";

const router: IRouter = Router();

/**
 * Projects router — Phase 2 placeholder.
 *
 * All endpoints return 501 Not Implemented until Phase 2 is complete:
 *   - Supabase Auth integration
 *   - Database schema pushed to production
 *   - Stripe payment verification
 *   - Project CRUD business logic
 *
 * TODO (Phase 2): Replace 501 stubs with real implementations using
 * Drizzle ORM queries against the annual_report_projects table.
 * Authenticate requests with Supabase Auth middleware.
 * Gate project creation behind project_entitlements check.
 */

router.get("/projects", (_req, res) => {
  res.status(501).json({
    error: "Not implemented",
    phase: "Phase 2 — requires Supabase Auth and database",
  });
});

router.post("/projects", (_req, res) => {
  res.status(501).json({
    error: "Not implemented",
    phase: "Phase 2 — requires Supabase Auth, database, and Stripe entitlement check",
  });
});

router.get("/projects/:projectId", (_req, res) => {
  res.status(501).json({
    error: "Not implemented",
    phase: "Phase 2 — requires Supabase Auth and database",
  });
});

router.get("/companies", (_req, res) => {
  res.status(501).json({
    error: "Not implemented",
    phase: "Phase 2 — requires Supabase Auth and database",
  });
});

router.post("/companies", (_req, res) => {
  res.status(501).json({
    error: "Not implemented",
    phase: "Phase 2 — requires Supabase Auth and database",
  });
});

export default router;
