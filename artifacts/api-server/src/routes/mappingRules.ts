/**
 * Read-only mapping-rules API.
 *
 * Exposes the canonical BAS account-range → report-line rules for the UI's
 * mapping-review screens. Auth-required but not project-scoped: the rule
 * catalogue is global to the tenant.
 */

import { Router, type IRouter } from "express";
import { listAllMappingRules } from "../helpers/autoMapper.js";

const router: IRouter = Router();

router.get("/mapping-rules", async (req, res) => {
  if (!req.profile?.id) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const rules = await listAllMappingRules();
  res.json({ rules });
});

export default router;
