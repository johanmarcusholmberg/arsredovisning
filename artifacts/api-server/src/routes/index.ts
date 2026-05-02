import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth.js";
import healthRouter from "./health";
import companiesRouter from "./companies";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import projectsRouter from "./projects";

const router: IRouter = Router();

router.use(healthRouter);

router.use(requireAuth);

router.use(companiesRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(projectsRouter);

export default router;
