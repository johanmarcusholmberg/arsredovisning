import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, companiesTable, reportsTable } from "@workspace/db";
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
    .where(eq(reportsTable.companyId, params.data.companyId))
    .orderBy(reportsTable.createdAt);

  res.json(ListReportsResponse.parse(reports));
});

router.post("/companies/:companyId/reports", async (req, res): Promise<void> => {
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
    .where(eq(companiesTable.id, params.data.companyId));

  if (!company) {
    res.status(404).json({ error: "not_found", message: "Company not found" });
    return;
  }

  const [report] = await db
    .insert(reportsTable)
    .values({
      companyId: params.data.companyId,
      fiscalYearStart: parsed.data.fiscalYearStart,
      fiscalYearEnd: parsed.data.fiscalYearEnd,
      accountingFramework: parsed.data.accountingFramework,
      status: "draft",
      completionPercent: 0,
      sectionsCompleted: 0,
      sectionsTotal: REPORT_SECTIONS.length,
    })
    .returning();

  const result = {
    ...report,
    companyName: company.name,
  };

  res.status(201).json(GetReportResponse.parse(result));
});

router.get("/reports/:reportId", async (req, res): Promise<void> => {
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
    .where(eq(reportsTable.id, params.data.reportId));

  if (!row) {
    res.status(404).json({ error: "not_found", message: "Report not found" });
    return;
  }

  res.json(GetReportResponse.parse(row));
});

router.patch("/reports/:reportId", async (req, res): Promise<void> => {
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

  const [row] = await db
    .update(reportsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(reportsTable.id, params.data.reportId))
    .returning();

  if (!row) {
    res.status(404).json({ error: "not_found", message: "Report not found" });
    return;
  }

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, row.companyId));

  const result = { ...row, companyName: company?.name ?? "" };
  res.json(UpdateReportResponse.parse(result));
});

router.get("/reports/:reportId/summary", async (req, res): Promise<void> => {
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
    .where(eq(reportsTable.id, params.data.reportId));

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

  const summary = {
    reportId: row.id,
    companyName: row.companyName,
    fiscalYearStart: row.fiscalYearStart,
    fiscalYearEnd: row.fiscalYearEnd,
    status: row.status,
    completionPercent: row.completionPercent,
    sections,
  };

  res.json(GetReportSummaryResponse.parse(summary));
});

export default router;
