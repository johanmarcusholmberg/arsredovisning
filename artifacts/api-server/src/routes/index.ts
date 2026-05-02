import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { syncProfile } from "../middlewares/profile.js";
import healthRouter from "./health";
import companiesRouter from "./companies";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import projectsRouter from "./projects";
import entitlementRouter from "./entitlement";
import filesRouter from "./files";

const router: IRouter = Router();

router.use(healthRouter);

router.use(requireAuth);
router.use(syncProfile);

router.use(companiesRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(projectsRouter);
router.use(entitlementRouter);
router.use(filesRouter);

export default router;
