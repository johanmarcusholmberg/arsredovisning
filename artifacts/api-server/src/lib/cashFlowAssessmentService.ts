/**
 * Cash flow requirement assessment — pure logic + DB read/write.
 *
 * Determines whether a Kassaflödesanalys is mandatory, optional, or unknown
 * for a given annual report project. The decision is based primarily on:
 *
 *   - legal form (Aktiebolag vs Bostadsrättsförening vs other)
 *   - report type (annual report vs group report)
 *   - listed-company status
 *   - "större företag" size assessment over the two most recent fiscal years
 *
 * The decision is NOT based on the K2 / K3 framework choice on its own.
 * Smaller companies may still opt in to a voluntary cash flow statement.
 */

import { eq } from "drizzle-orm";
import {
  db,
  cashFlowRequirementAssessmentsTable,
  annualReportProjectsTable,
  companiesTable,
  type CashFlowRequirementAssessment,
} from "@workspace/db";
import { SIZE_THRESHOLDS } from "./complianceConfig.js";

export type CashFlowRequirement =
  | "mandatory"
  | "optional"
  | "not_supported"
  | "unknown";
export type LargerCompanyAssessment = "true" | "false" | "unknown";
export type AssessmentStatus =
  | "calculated"
  | "needs_user_confirmation"
  | "manually_overridden";

export interface AssessmentInputs {
  legalForm: string; // "AB", "BRF", "EK", ...
  reportType: "annual_report" | "group_report";
  isListedCompany: boolean;
  isHousingAssociation: boolean;
  voluntaryEnabled: boolean;
  employeesCurrentYear: number | null;
  employeesPreviousYear: number | null;
  balanceTotalCurrentYear: number | null;
  balanceTotalPreviousYear: number | null;
  netRevenueCurrentYear: number | null;
  netRevenuePreviousYear: number | null;
}

export interface AssessmentResult {
  cashFlowRequirement: CashFlowRequirement;
  largerCompanyAssessment: LargerCompanyAssessment;
  assessmentStatus: AssessmentStatus;
  thresholdEmployeesMet: boolean | null;
  thresholdBalanceTotalMet: boolean | null;
  thresholdNetRevenueMet: boolean | null;
  /** Inputs that the user still needs to confirm. */
  missingInputs: string[];
  /** Plain-Swedish explanation of the verdict. */
  explanationSv: string;
}

/**
 * Pure assessment — does not touch the DB. Re-export the same logic for unit
 * testing and for live "what-if" UX.
 */
export function assessCashFlowRequirement(
  inputs: AssessmentInputs,
): AssessmentResult {
  const missing: string[] = [];

  // Bostadsrättsförening — kassaflöde alltid obligatoriskt enligt BFNAR.
  if (inputs.isHousingAssociation || inputs.legalForm.toUpperCase() === "BRF") {
    return {
      cashFlowRequirement: "mandatory",
      largerCompanyAssessment: "unknown",
      assessmentStatus: "calculated",
      thresholdEmployeesMet: null,
      thresholdBalanceTotalMet: null,
      thresholdNetRevenueMet: null,
      missingInputs: [],
      explanationSv:
        "Bostadsrättsföreningar ska upprätta kassaflödesanalys i sin årsredovisning.",
    };
  }

  // Koncernredovisning — kassaflöde obligatorisk i koncernens årsredovisning.
  if (inputs.reportType === "group_report") {
    return {
      cashFlowRequirement: "mandatory",
      largerCompanyAssessment: "unknown",
      assessmentStatus: "calculated",
      thresholdEmployeesMet: null,
      thresholdBalanceTotalMet: null,
      thresholdNetRevenueMet: null,
      missingInputs: [],
      explanationSv:
        "I koncernredovisning ska kassaflödesanalys ingå tillsammans med koncernens övriga finansiella rapporter.",
    };
  }

  // Listed → "större företag" → mandatory.
  if (inputs.isListedCompany) {
    return {
      cashFlowRequirement: "mandatory",
      largerCompanyAssessment: "true",
      assessmentStatus: "calculated",
      thresholdEmployeesMet: null,
      thresholdBalanceTotalMet: null,
      thresholdNetRevenueMet: null,
      missingInputs: [],
      explanationSv:
        "Företaget är noterat på en reglerad marknad och räknas därmed som större företag — kassaflödesanalys är obligatorisk.",
    };
  }

  // Size assessment over two most recent fiscal years.
  const checks = [
    {
      key: "employees",
      curr: inputs.employeesCurrentYear,
      prev: inputs.employeesPreviousYear,
      threshold: SIZE_THRESHOLDS.employees,
      missingCurrent: "employeesCurrentYear",
      missingPrevious: "employeesPreviousYear",
    },
    {
      key: "balance_total",
      curr: inputs.balanceTotalCurrentYear,
      prev: inputs.balanceTotalPreviousYear,
      threshold: SIZE_THRESHOLDS.balanceTotal,
      missingCurrent: "balanceTotalCurrentYear",
      missingPrevious: "balanceTotalPreviousYear",
    },
    {
      key: "net_revenue",
      curr: inputs.netRevenueCurrentYear,
      prev: inputs.netRevenuePreviousYear,
      threshold: SIZE_THRESHOLDS.netRevenue,
      missingCurrent: "netRevenueCurrentYear",
      missingPrevious: "netRevenuePreviousYear",
    },
  ];

  const perCheck: Record<string, boolean | null> = {};
  for (const c of checks) {
    if (c.curr == null) missing.push(c.missingCurrent);
    if (c.prev == null) missing.push(c.missingPrevious);
    if (c.curr == null || c.prev == null) {
      perCheck[c.key] = null;
    } else {
      // Threshold is "exceeded" in BOTH years → met.
      perCheck[c.key] = c.curr > c.threshold && c.prev > c.threshold;
    }
  }

  // If ANY required input is missing, we cannot determine the verdict
  // automatically — needs user confirmation.
  if (missing.length > 0) {
    return {
      cashFlowRequirement: "unknown",
      largerCompanyAssessment: "unknown",
      assessmentStatus: "needs_user_confirmation",
      thresholdEmployeesMet: perCheck.employees,
      thresholdBalanceTotalMet: perCheck.balance_total,
      thresholdNetRevenueMet: perCheck.net_revenue,
      missingInputs: missing,
      explanationSv:
        "Vi behöver bekräfta några uppgifter innan vi kan avgöra om kassaflödesanalys är obligatorisk.",
    };
  }

  const exceededCount = checks.filter((c) => perCheck[c.key] === true).length;
  const isLarger = exceededCount > 1; // "more than one"

  if (isLarger) {
    return {
      cashFlowRequirement: "mandatory",
      largerCompanyAssessment: "true",
      assessmentStatus: "calculated",
      thresholdEmployeesMet: perCheck.employees,
      thresholdBalanceTotalMet: perCheck.balance_total,
      thresholdNetRevenueMet: perCheck.net_revenue,
      missingInputs: [],
      explanationSv:
        "Företaget överskrider mer än ett av gränsvärdena för anställda, balansomslutning eller nettoomsättning under båda räkenskapsåren — det räknas som större företag och kassaflödesanalys är obligatorisk.",
    };
  }

  return {
    cashFlowRequirement: "optional",
    largerCompanyAssessment: "false",
    assessmentStatus: "calculated",
    thresholdEmployeesMet: perCheck.employees,
    thresholdBalanceTotalMet: perCheck.balance_total,
    thresholdNetRevenueMet: perCheck.net_revenue,
    missingInputs: [],
    explanationSv:
      "Företaget bedöms inte uppfylla kriterierna för större företag. Kassaflödesanalys är frivillig — du kan välja att inkludera den ändå.",
  };
}

/**
 * Load (or seed) the assessment row for a project, recompute the verdict,
 * persist it, and return the merged result.
 */
export async function getOrCreateAssessment(
  projectId: string,
): Promise<CashFlowRequirementAssessment> {
  const [existing] = await db
    .select()
    .from(cashFlowRequirementAssessmentsTable)
    .where(eq(cashFlowRequirementAssessmentsTable.projectId, projectId))
    .limit(1);
  if (existing) return existing;

  const [project] = await db
    .select({
      project: annualReportProjectsTable,
      company: companiesTable,
    })
    .from(annualReportProjectsTable)
    .innerJoin(
      companiesTable,
      eq(annualReportProjectsTable.companyId, companiesTable.id),
    )
    .where(eq(annualReportProjectsTable.id, projectId))
    .limit(1);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const fy = `${project.project.fiscalYearStart}–${project.project.fiscalYearEnd}`;
  const [created] = await db
    .insert(cashFlowRequirementAssessmentsTable)
    .values({
      projectId,
      companyId: project.company.id,
      financialYear: fy,
      legalForm: project.company.legalForm,
      reportingFramework: project.project.accountingFramework,
      reportType: "annual_report",
    })
    .returning();
  return created;
}

export interface UpdateAssessmentParams {
  legalForm?: string;
  reportType?: "annual_report" | "group_report";
  isListedCompany?: boolean;
  isHousingAssociation?: boolean;
  voluntaryEnabled?: boolean;
  employeesCurrentYear?: number | null;
  employeesPreviousYear?: number | null;
  balanceTotalCurrentYear?: number | null;
  balanceTotalPreviousYear?: number | null;
  netRevenueCurrentYear?: number | null;
  netRevenuePreviousYear?: number | null;
  userOverrideRequirement?: CashFlowRequirement | null;
  userOverrideReason?: string | null;
  reviewedByUserId?: string | null;
}

/**
 * Update assessment inputs, recompute, and persist.
 */
export async function updateAssessment(
  projectId: string,
  patch: UpdateAssessmentParams,
): Promise<CashFlowRequirementAssessment> {
  const current = await getOrCreateAssessment(projectId);

  const merged = {
    legalForm: patch.legalForm ?? current.legalForm,
    reportType: patch.reportType ?? current.reportType,
    isListedCompany: patch.isListedCompany ?? current.isListedCompany,
    isHousingAssociation:
      patch.isHousingAssociation ?? current.isHousingAssociation,
    voluntaryEnabled: patch.voluntaryEnabled ?? current.voluntaryEnabled,
    employeesCurrentYear:
      patch.employeesCurrentYear !== undefined
        ? patch.employeesCurrentYear
        : current.employeesCurrentYear,
    employeesPreviousYear:
      patch.employeesPreviousYear !== undefined
        ? patch.employeesPreviousYear
        : current.employeesPreviousYear,
    balanceTotalCurrentYear:
      patch.balanceTotalCurrentYear !== undefined
        ? patch.balanceTotalCurrentYear
        : current.balanceTotalCurrentYear === null
          ? null
          : Number(current.balanceTotalCurrentYear),
    balanceTotalPreviousYear:
      patch.balanceTotalPreviousYear !== undefined
        ? patch.balanceTotalPreviousYear
        : current.balanceTotalPreviousYear === null
          ? null
          : Number(current.balanceTotalPreviousYear),
    netRevenueCurrentYear:
      patch.netRevenueCurrentYear !== undefined
        ? patch.netRevenueCurrentYear
        : current.netRevenueCurrentYear === null
          ? null
          : Number(current.netRevenueCurrentYear),
    netRevenuePreviousYear:
      patch.netRevenuePreviousYear !== undefined
        ? patch.netRevenuePreviousYear
        : current.netRevenuePreviousYear === null
          ? null
          : Number(current.netRevenuePreviousYear),
  };

  const result = assessCashFlowRequirement(merged);

  // Manual override takes precedence.
  let finalRequirement = result.cashFlowRequirement;
  let finalStatus = result.assessmentStatus;
  if (patch.userOverrideRequirement) {
    finalRequirement = patch.userOverrideRequirement;
    finalStatus = "manually_overridden";
  }

  const [updated] = await db
    .update(cashFlowRequirementAssessmentsTable)
    .set({
      legalForm: merged.legalForm,
      reportType: merged.reportType,
      isListedCompany: merged.isListedCompany,
      isHousingAssociation: merged.isHousingAssociation,
      voluntaryEnabled: merged.voluntaryEnabled,
      employeesCurrentYear: merged.employeesCurrentYear,
      employeesPreviousYear: merged.employeesPreviousYear,
      balanceTotalCurrentYear:
        merged.balanceTotalCurrentYear === null
          ? null
          : String(merged.balanceTotalCurrentYear),
      balanceTotalPreviousYear:
        merged.balanceTotalPreviousYear === null
          ? null
          : String(merged.balanceTotalPreviousYear),
      netRevenueCurrentYear:
        merged.netRevenueCurrentYear === null
          ? null
          : String(merged.netRevenueCurrentYear),
      netRevenuePreviousYear:
        merged.netRevenuePreviousYear === null
          ? null
          : String(merged.netRevenuePreviousYear),
      thresholdEmployeesMet: result.thresholdEmployeesMet,
      thresholdBalanceTotalMet: result.thresholdBalanceTotalMet,
      thresholdNetRevenueMet: result.thresholdNetRevenueMet,
      largerCompanyAssessment: result.largerCompanyAssessment,
      cashFlowRequirement: finalRequirement,
      assessmentStatus: finalStatus,
      userOverrideReason:
        patch.userOverrideReason !== undefined
          ? patch.userOverrideReason
          : current.userOverrideReason,
      reviewedByUserId:
        patch.reviewedByUserId !== undefined
          ? patch.reviewedByUserId
          : current.reviewedByUserId,
      reviewedAt: patch.reviewedByUserId ? new Date() : current.reviewedAt,
      updatedAt: new Date(),
    })
    .where(eq(cashFlowRequirementAssessmentsTable.projectId, projectId))
    .returning();

  return updated;
}

/**
 * Compute the live verdict from a stored row (without persisting).
 * Useful for the validation engine and UI.
 */
export function deriveAssessmentResult(
  row: CashFlowRequirementAssessment,
): AssessmentResult {
  return assessCashFlowRequirement({
    legalForm: row.legalForm,
    reportType: row.reportType,
    isListedCompany: row.isListedCompany,
    isHousingAssociation: row.isHousingAssociation,
    voluntaryEnabled: row.voluntaryEnabled,
    employeesCurrentYear: row.employeesCurrentYear,
    employeesPreviousYear: row.employeesPreviousYear,
    balanceTotalCurrentYear:
      row.balanceTotalCurrentYear === null
        ? null
        : Number(row.balanceTotalCurrentYear),
    balanceTotalPreviousYear:
      row.balanceTotalPreviousYear === null
        ? null
        : Number(row.balanceTotalPreviousYear),
    netRevenueCurrentYear:
      row.netRevenueCurrentYear === null
        ? null
        : Number(row.netRevenueCurrentYear),
    netRevenuePreviousYear:
      row.netRevenuePreviousYear === null
        ? null
        : Number(row.netRevenuePreviousYear),
  });
}

/**
 * Whether the cash flow statement should be included in the final export
 * for a given assessment row.
 */
export function shouldIncludeCashFlow(
  row: CashFlowRequirementAssessment,
): boolean {
  if (row.cashFlowRequirement === "mandatory") return true;
  if (row.cashFlowRequirement === "optional" && row.voluntaryEnabled)
    return true;
  return false;
}
