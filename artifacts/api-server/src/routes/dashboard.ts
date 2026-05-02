import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, companiesTable, reportsTable } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const [companiesCount] = await db
    .select({ count: count() })
    .from(companiesTable);

  const [totalReportsCount] = await db
    .select({ count: count() })
    .from(reportsTable);

  const allReports = await db
    .select({ status: reportsTable.status })
    .from(reportsTable);

  const reportsInProgress = allReports.filter((r) => r.status === "in_progress").length;
  const reportsComplete = allReports.filter((r) => r.status === "complete" || r.status === "exported").length;

  const recentReports = await db
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
    .orderBy(reportsTable.updatedAt)
    .limit(5);

  const summary = {
    totalCompanies: Number(companiesCount?.count ?? 0),
    totalReports: Number(totalReportsCount?.count ?? 0),
    reportsInProgress,
    reportsComplete,
    recentReports,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

export default router;
