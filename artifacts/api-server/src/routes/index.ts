import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { syncProfile } from "../middlewares/profile.js";
import { gateProjectWrites } from "../middlewares/gateProjectWrites.js";
import healthRouter from "./health";
import clientErrorsRouter from "./clientErrors";
import eventsRouter from "./events";
import companiesRouter from "./companies";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import projectsRouter from "./projects";
import entitlementRouter from "./entitlement";
import filesRouter from "./files";
import financialStatementsRouter from "./financialStatements";
import notesRouter from "./notes";
import noteRowsRouter from "./noteRows";
import validationRouter from "./validation";
import reviewsRouter from "./reviews";
import collaboratorsRouter from "./collaborators";
import importsRouter from "./imports";
import mappingsRouter from "./mappings";
import mappingRulesRouter from "./mappingRules";
import reclassificationsRouter from "./reclassifications";
import cashFlowRouter from "./cashFlow";
import annualReportExportRouter from "./annualReportExport";
import meRouter from "./me";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientErrorsRouter);
router.use(eventsRouter);

router.use(requireAuth);
router.use(syncProfile);

// Centralised entitlement + edit gate for every write under /reports/* and
// /projects/*. Mount BEFORE the per-feature routers so a missing inline check
// in any future write endpoint can never bypass the paid wall.
router.use(gateProjectWrites);

router.use(companiesRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(projectsRouter);
router.use(entitlementRouter);
router.use(filesRouter);
router.use(financialStatementsRouter);
router.use(noteRowsRouter);
router.use(notesRouter);
router.use(validationRouter);
router.use(reviewsRouter);
router.use(collaboratorsRouter);
router.use(importsRouter);
router.use(mappingsRouter);
router.use(mappingRulesRouter);
router.use(reclassificationsRouter);
router.use(cashFlowRouter);
router.use(annualReportExportRouter);
router.use(meRouter);
router.use(adminRouter);

export default router;
