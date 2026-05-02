import { Router, type IRouter } from "express";
import healthRouter from "./health";
import companiesRouter from "./companies";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(companiesRouter);
router.use(reportsRouter);
router.use(dashboardRouter);

export default router;
