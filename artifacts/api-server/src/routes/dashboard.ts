import { Router, type IRouter } from "express";
import { eq, count, and } from "drizzle-orm";
import { db, companiesTable, reportsTable } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const [companiesCount] = await db
    .select({ count: count() })
    .from(companiesTable)
    .where(eq(companiesTable.createdByProfileId, profileId));

  const userReports = await db
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
    .where(eq(companiesTable.createdByProfileId, profileId))
    .orderBy(reportsTable.updatedAt);

  const reportsInProgress = userReports.filter((r) => r.status === "in_progress").length;
  const reportsComplete = userReports.filter(
    (r) => r.status === "complete" || r.status === "exported",
  ).length;

  const recentReports = userReports.slice(-5).reverse();

  const summary = {
    totalCompanies: Number(companiesCount?.count ?? 0),
    totalReports: userReports.length,
    reportsInProgress,
    reportsComplete,
    recentReports,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

export default router;
