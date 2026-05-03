import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  companiesTable,
  reportsTable,
  annualReportProjectsTable,
  projectEntitlementsTable,
} from "@workspace/db";
import {
  CreateReportBody,
  CreateReportParams,
  UpdateReportBody,
  UpdateReportParams,
  GetReportParams,
  ListReportsParams,
  GetReportSummaryParams,
  GetReportResponse,
  UpdateReportResponse,
  ListReportsResponse,
  GetReportSummaryResponse,
} from "@workspace/api-zod";
import { logAuditEvent } from "../lib/auditLog.js";
import { resolveProjectForReport } from "../helpers/projectReportLink.js";

const REPORT_SECTIONS = [
  { key: "forvaltningsberattelse", label: "Förvaltningsberättelse", requiredFields: 5 },
  { key: "resultatrakning", label: "Resultaträkning", requiredFields: 8 },
  { key: "balansrakning", label: "Balansräkning", requiredFields: 10 },
  { key: "noter", label: "Noter", requiredFields: 6 },
  { key: "underskrifter", label: "Underskrifter", requiredFields: 2 },
  { key: "revisionsberattelse", label: "Revisionsberättelse", requiredFields: 1 },
];

const router: IRouter = Router();

router.get("/companies/:companyId/reports", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const params = ListReportsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const reports = await db
    .select({
      id: reportsTable.id,
      companyId: reportsTable.companyId,
      companyName: companiesTable.name,
      fiscalYearStart: reportsTable.fiscalYearStart,
      fiscalYearEnd: reportsTable.fiscalYearEnd,
      status: reportsTable.status,
      accountingFramework: reportsTable.accountingFramework,
      completionPercent: reportsTable.completionPercent,
      sectionsCompleted: reportsTable.sectionsCompleted,
      sectionsTotal: reportsTable.sectionsTotal,
      createdAt: reportsTable.createdAt,
      updatedAt: reportsTable.updatedAt,
    })
    .from(reportsTable)
    .innerJoin(companiesTable, eq(reportsTable.companyId, companiesTable.id))
    .where(
      and(
        eq(reportsTable.companyId, params.data.companyId),
        eq(companiesTable.createdByProfileId, profileId),
      ),
    )
    .orderBy(reportsTable.createdAt);

  res.json(ListReportsResponse.parse(reports));
});

router.post("/companies/:companyId/reports", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const params = CreateReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", message: parsed.error.message });
    return;
  }

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(
      and(
        eq(companiesTable.id, params.data.companyId),
        eq(companiesTable.createdByProfileId, profileId),
      ),
    );

  if (!company) {
    res.status(404).json({ error: "not_found", message: "Company not found" });
    return;
  }

  const fiscalYearStart =
    (parsed.data.fiscalYearStart as unknown) instanceof Date
      ? (parsed.data.fiscalYearStart as unknown as Date).toISOString().slice(0, 10)
      : String(parsed.data.fiscalYearStart);
  const fiscalYearEnd =
    (parsed.data.fiscalYearEnd as unknown) instanceof Date
      ? (parsed.data.fiscalYearEnd as unknown as Date).toISOString().slice(0, 10)
      : String(parsed.data.fiscalYearEnd);

  const [report] = await db
    .insert(reportsTable)
    .values({
      companyId: params.data.companyId,
      fiscalYearStart,
      fiscalYearEnd,
      accountingFramework: parsed.data.accountingFramework,
      status: "draft",
      completionPercent: 0,
      sectionsCompleted: 0,
      sectionsTotal: REPORT_SECTIONS.length,
    })
    .returning();

  // Auto-create the matching annual_report_projects row + a manual_grant
  // entitlement so the report can immediately import SIE / CSV / Excel files.
  // Previously this step was missing — every newly created report opened the
  // import page with "Inget projekt kopplat" and was effectively blocked.
  // We deduplicate by (company, fiscalYear) so re-runs are safe.
  const [existingProject] = await db
    .select({ id: annualReportProjectsTable.id })
    .from(annualReportProjectsTable)
    .where(
      and(
        eq(annualReportProjectsTable.companyId, params.data.companyId),
        eq(annualReportProjectsTable.fiscalYearStart, fiscalYearStart),
        eq(annualReportProjectsTable.fiscalYearEnd, fiscalYearEnd),
      ),
    )
    .limit(1);

  let projectId: string | null = existingProject?.id ?? null;
  if (!projectId) {
    try {
      const [project] = await db
        .insert(annualReportProjectsTable)
        .values({
          companyId: params.data.companyId,
          fiscalYearStart,
          fiscalYearEnd,
          accountingFramework: parsed.data.accountingFramework,
          status: "draft",
          noteNumberingScheme: "sequential",
          createdByProfileId: profileId,
        })
        .returning({ id: annualReportProjectsTable.id });
      projectId = project?.id ?? null;

      if (projectId) {
        await db.insert(projectEntitlementsTable).values({
          projectId,
          profileId,
          entitlementType: "manual_grant",
          source: "auto_grant_on_report_create",
          isActive: true,
        });
      }
    } catch (err) {
      // Best-effort: report row is already persisted. Log and continue so the
      // user gets their report; they can still revisit the import page once
      // the project is created out-of-band.
      req.log.warn(
        { err, reportId: report.id, companyId: params.data.companyId },
        "Failed to auto-create annual_report_projects row for new report",
      );
    }
  }

  await logAuditEvent({
    eventType: "report.created",
    actorProfileId: profileId,
    companyId: company.id,
    payload: {
      reportId: report.id,
      projectId,
      fiscalYearStart: report.fiscalYearStart,
      fiscalYearEnd: report.fiscalYearEnd,
    },
  });

  res.status(201).json(GetReportResponse.parse({ ...report, companyName: company.name }));
});

router.get("/reports/:reportId/project", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const { reportId } = req.params;

  // Enforce ownership: the report must belong to a company owned by the
  // current profile. This mirrors the access model used by GET /reports/:id.
  const [ownershipRow] = await db
    .select({ id: reportsTable.id })
    .from(reportsTable)
    .innerJoin(companiesTable, eq(reportsTable.companyId, companiesTable.id))
    .where(
      and(
        eq(reportsTable.id, reportId),
        eq(companiesTable.createdByProfileId, profileId),
      ),
    )
    .limit(1);

  if (!ownershipRow) {
    res.status(404).json({ error: "not_found", message: "Report not found" });
    return;
  }

  const resolved = await resolveProjectForReport(reportId);
  if (!resolved) {
    res.status(404).json({ error: "not_found", message: "Report not found" });
    return;
  }

  res.json({
    projectId: resolved.projectId,
    companyId: resolved.companyId,
    fiscalYearStart: resolved.fiscalYearStart,
    fiscalYearEnd: resolved.fiscalYearEnd,
    framework: resolved.framework,
    reportStatus: resolved.reportStatus,
  });
});

router.get("/reports/:reportId", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const params = GetReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const [row] = await db
    .select({
      id: reportsTable.id,
      companyId: reportsTable.companyId,
      companyName: companiesTable.name,
      fiscalYearStart: reportsTable.fiscalYearStart,
      fiscalYearEnd: reportsTable.fiscalYearEnd,
      status: reportsTable.status,
      accountingFramework: reportsTable.accountingFramework,
      completionPercent: reportsTable.completionPercent,
      sectionsCompleted: reportsTable.sectionsCompleted,
      sectionsTotal: reportsTable.sectionsTotal,
      createdAt: reportsTable.createdAt,
      updatedAt: reportsTable.updatedAt,
    })
    .from(reportsTable)
    .innerJoin(companiesTable, eq(reportsTable.companyId, companiesTable.id))
    .where(
      and(
        eq(reportsTable.id, params.data.reportId),
        eq(companiesTable.createdByProfileId, profileId),
      ),
    );

  if (!row) {
    res.status(404).json({ error: "not_found", message: "Report not found" });
    return;
  }

  res.json(GetReportResponse.parse(row));
});

router.patch("/reports/:reportId", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const params = UpdateReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const parsed = UpdateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", message: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select({ companyId: reportsTable.companyId })
    .from(reportsTable)
    .innerJoin(companiesTable, eq(reportsTable.companyId, companiesTable.id))
    .where(
      and(
        eq(reportsTable.id, params.data.reportId),
        eq(companiesTable.createdByProfileId, profileId),
      ),
    );

  if (!existing) {
    res.status(404).json({ error: "not_found", message: "Report not found" });
    return;
  }

  const [row] = await db
    .update(reportsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(reportsTable.id, params.data.reportId))
    .returning();

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, row.companyId));

  res.json(UpdateReportResponse.parse({ ...row, companyName: company?.name ?? "" }));
});

router.get("/reports/:reportId/summary", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const params = GetReportSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const [row] = await db
    .select({
      id: reportsTable.id,
      companyId: reportsTable.companyId,
      companyName: companiesTable.name,
      fiscalYearStart: reportsTable.fiscalYearStart,
      fiscalYearEnd: reportsTable.fiscalYearEnd,
      status: reportsTable.status,
      completionPercent: reportsTable.completionPercent,
      sectionsCompleted: reportsTable.sectionsCompleted,
      sectionsTotal: reportsTable.sectionsTotal,
    })
    .from(reportsTable)
    .innerJoin(companiesTable, eq(reportsTable.companyId, companiesTable.id))
    .where(
      and(
        eq(reportsTable.id, params.data.reportId),
        eq(companiesTable.createdByProfileId, profileId),
      ),
    );

  if (!row) {
    res.status(404).json({ error: "not_found", message: "Report not found" });
    return;
  }

  const sections = REPORT_SECTIONS.map((s, i) => ({
    key: s.key,
    label: s.label,
    completed: i < row.sectionsCompleted,
    requiredFields: s.requiredFields,
    completedFields: i < row.sectionsCompleted ? s.requiredFields : 0,
  }));

  res.json(
    GetReportSummaryResponse.parse({
      reportId: row.id,
      companyName: row.companyName,
      fiscalYearStart: row.fiscalYearStart,
      fiscalYearEnd: row.fiscalYearEnd,
      status: row.status,
      completionPercent: row.completionPercent,
      sections,
    }),
  );
});

export default router;
