import {
  pgTable,
  text,
  timestamp,
  uuid,
  numeric,
  integer,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { annualReportProjectsTable } from "./annualReportProjects";
import { companiesTable } from "./companies";
import { profilesTable } from "./profiles";
import {
  cashFlowRequirementEnum,
  cashFlowAssessmentStatusEnum,
  cashFlowLargerCompanyEnum,
  cashFlowReportTypeEnum,
} from "./enums";

/**
 * cash_flow_requirement_assessments — one row per project recording whether
 * a Swedish cash flow statement (Kassaflödesanalys) is mandatory, optional,
 * or unknown.
 *
 * Drives the workflow card "Behövs kassaflödesanalys?" and the export gate.
 */
export const cashFlowRequirementAssessmentsTable = pgTable(
  "cash_flow_requirement_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => annualReportProjectsTable.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    financialYear: text("financial_year").notNull(),
    legalForm: text("legal_form").notNull().default("AB"),
    reportingFramework: text("reporting_framework").notNull().default("K3"),
    reportType: cashFlowReportTypeEnum("report_type")
      .notNull()
      .default("annual_report"),
    isListedCompany: boolean("is_listed_company").notNull().default(false),
    isHousingAssociation: boolean("is_housing_association")
      .notNull()
      .default(false),
    voluntaryEnabled: boolean("voluntary_enabled").notNull().default(false),

    employeesCurrentYear: integer("employees_current_year"),
    employeesPreviousYear: integer("employees_previous_year"),
    balanceTotalCurrentYear: numeric("balance_total_current_year", {
      precision: 18,
      scale: 2,
    }),
    balanceTotalPreviousYear: numeric("balance_total_previous_year", {
      precision: 18,
      scale: 2,
    }),
    netRevenueCurrentYear: numeric("net_revenue_current_year", {
      precision: 18,
      scale: 2,
    }),
    netRevenuePreviousYear: numeric("net_revenue_previous_year", {
      precision: 18,
      scale: 2,
    }),

    thresholdEmployeesMet: boolean("threshold_employees_met"),
    thresholdBalanceTotalMet: boolean("threshold_balance_total_met"),
    thresholdNetRevenueMet: boolean("threshold_net_revenue_met"),

    largerCompanyAssessment: cashFlowLargerCompanyEnum(
      "larger_company_assessment",
    )
      .notNull()
      .default("unknown"),
    cashFlowRequirement: cashFlowRequirementEnum("cash_flow_requirement")
      .notNull()
      .default("unknown"),
    assessmentStatus: cashFlowAssessmentStatusEnum("assessment_status")
      .notNull()
      .default("needs_user_confirmation"),

    userOverrideReason: text("user_override_reason"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(
      () => profilesTable.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    projectIdx: uniqueIndex("cf_req_assess_project_idx").on(t.projectId),
    companyIdx: index("cf_req_assess_company_idx").on(t.companyId),
  }),
);

export const insertCashFlowRequirementAssessmentSchema = createInsertSchema(
  cashFlowRequirementAssessmentsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertCashFlowRequirementAssessment = z.infer<
  typeof insertCashFlowRequirementAssessmentSchema
>;
export type CashFlowRequirementAssessment =
  typeof cashFlowRequirementAssessmentsTable.$inferSelect;
