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
import financialStatementsRouter from "./financialStatements";
import notesRouter from "./notes";
import validationRouter from "./validation";
import reviewsRouter from "./reviews";
import collaboratorsRouter from "./collaborators";
import importsRouter from "./imports";
import mappingsRouter from "./mappings";

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
router.use(financialStatementsRouter);
router.use(notesRouter);
router.use(validationRouter);
router.use(reviewsRouter);
router.use(collaboratorsRouter);
router.use(importsRouter);
router.use(mappingsRouter);

export default router;
