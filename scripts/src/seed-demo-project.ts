/**
 * seed-demo-project.ts
 *
 * Idempotently creates the shared demo project that the Årsredovisningar app
 * relies on. The demo project lets unauthenticated / unpaid users explore
 * the application with a sandboxed, watermarked dataset.
 *
 * What this script guarantees exists after a successful run:
 *
 *   - companies row             "Demo AB" with a fixed demo organisationsnummer
 *   - annual_report_projects    DEMO_PROJECT_ID, is_demo = true, marked "Demo"
 *   - reports                   one demo report attached to the company
 *   - financial_statement_lines a small income-statement / balance-sheet sample
 *   - report_notes              two simple sample notes
 *
 * The demo data is deliberately minimal — enough for the UI to render every
 * section without crashing, but clearly recognisable as sample data
 * ("DEMO – exempelvärden, ej riktiga siffror" prefixes everywhere).
 *
 * Idempotency: every insert uses ON CONFLICT DO NOTHING / pre-checks so
 * running this script multiple times is safe and never duplicates data.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run seed-demo-project
 *
 * Re-run after schema changes to top up any newly-required demo rows.
 */

import { eq, and } from "drizzle-orm";
import {
  db,
  companiesTable,
  annualReportProjectsTable,
  reportsTable,
  financialStatementLinesTable,
  reportNotesTable,
} from "@workspace/db";

// Must match artifacts/api-server/src/helpers/demo.ts → DEMO_PROJECT_ID.
const DEMO_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_ORG_NUMBER = "000000-0001";
const DEMO_COMPANY_NAME = "Demo AB (exempelbolag)";
const DEMO_LABEL_PREFIX = "DEMO – ";

async function ensureDemoCompany(): Promise<string> {
  const [existing] = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.organizationNumber, DEMO_ORG_NUMBER))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(companiesTable)
    .values({
      name: DEMO_COMPANY_NAME,
      organizationNumber: DEMO_ORG_NUMBER,
      legalForm: "AB",
      accountingFramework: "K2",
      fiscalYearStart: "01-01",
      fiscalYearEnd: "12-31",
      address: "Exempelgatan 1",
      city: "Stockholm",
      postalCode: "111 11",
    })
    .returning({ id: companiesTable.id });
  console.log(`[seed-demo] Created demo company ${created.id}`);
  return created.id;
}

async function ensureDemoProject(companyId: string): Promise<void> {
  const [existing] = await db
    .select({ id: annualReportProjectsTable.id })
    .from(annualReportProjectsTable)
    .where(eq(annualReportProjectsTable.id, DEMO_PROJECT_ID))
    .limit(1);
  if (existing) {
    // Top-up: make sure the demo flag and company link are still correct.
    await db
      .update(annualReportProjectsTable)
      .set({
        isDemo: true,
        companyId,
        coverTitle: `${DEMO_LABEL_PREFIX}Årsredovisning`,
        coverSubtitle: "Endast exempelvärden — inte ett riktigt projekt",
        updatedAt: new Date(),
      })
      .where(eq(annualReportProjectsTable.id, DEMO_PROJECT_ID));
    return;
  }

  await db.insert(annualReportProjectsTable).values({
    id: DEMO_PROJECT_ID,
    companyId,
    fiscalYearStart: "2024-01-01",
    fiscalYearEnd: "2024-12-31",
    accountingFramework: "K2",
    annualReportLanguage: "sv",
    status: "draft",
    isDemo: true,
    coverMode: "auto",
    coverTitle: `${DEMO_LABEL_PREFIX}Årsredovisning`,
    coverSubtitle: "Endast exempelvärden — inte ett riktigt projekt",
  });
  console.log(`[seed-demo] Created demo project ${DEMO_PROJECT_ID}`);
}

async function ensureDemoReport(companyId: string): Promise<string> {
  const [existing] = await db
    .select({ id: reportsTable.id })
    .from(reportsTable)
    .where(
      and(
        eq(reportsTable.companyId, companyId),
        eq(reportsTable.fiscalYearStart, "2024-01-01"),
        eq(reportsTable.fiscalYearEnd, "2024-12-31"),
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(reportsTable)
    .values({
      companyId,
      fiscalYearStart: "2024-01-01",
      fiscalYearEnd: "2024-12-31",
      status: "draft",
      accountingFramework: "K2",
      completionPercent: 0,
      sectionsCompleted: 0,
      sectionsTotal: 6,
    })
    .returning({ id: reportsTable.id });
  console.log(`[seed-demo] Created demo report ${created.id}`);
  return created.id;
}

async function ensureDemoStatementLines(reportId: string): Promise<void> {
  const [existing] = await db
    .select({ id: financialStatementLinesTable.id })
    .from(financialStatementLinesTable)
    .where(eq(financialStatementLinesTable.reportId, reportId))
    .limit(1);
  if (existing) return;

  type StatementLine = typeof financialStatementLinesTable.$inferInsert;
  const lines: StatementLine[] = [
    {
      reportId,
      statementType: "income_statement",
      lineKey: "net_revenue",
      swedishLabel: `${DEMO_LABEL_PREFIX}Nettoomsättning`,
      sortOrder: 10,
      currentYearAmount: "1000000.00",
      previousYearAmount: "850000.00",
      previousYearSource: "manual",
    },
    {
      reportId,
      statementType: "income_statement",
      lineKey: "personnel_costs",
      swedishLabel: `${DEMO_LABEL_PREFIX}Personalkostnader`,
      sortOrder: 20,
      currentYearAmount: "-500000.00",
      previousYearAmount: "-420000.00",
      previousYearSource: "manual",
    },
    {
      reportId,
      statementType: "income_statement",
      lineKey: "operating_result",
      swedishLabel: `${DEMO_LABEL_PREFIX}Rörelseresultat`,
      sortOrder: 90,
      isSubtotal: true,
      currentYearAmount: "500000.00",
      previousYearAmount: "430000.00",
      previousYearSource: "manual",
    },
    {
      reportId,
      statementType: "balance_sheet",
      lineKey: "cash_and_bank",
      swedishLabel: `${DEMO_LABEL_PREFIX}Kassa och bank`,
      sortOrder: 10,
      currentYearAmount: "750000.00",
      previousYearAmount: "300000.00",
      previousYearSource: "manual",
    },
    {
      reportId,
      statementType: "balance_sheet",
      lineKey: "equity",
      swedishLabel: `${DEMO_LABEL_PREFIX}Eget kapital`,
      sortOrder: 100,
      currentYearAmount: "750000.00",
      previousYearAmount: "300000.00",
      previousYearSource: "manual",
    },
  ];
  for (const line of lines) {
    await db.insert(financialStatementLinesTable).values(line);
  }
  console.log(`[seed-demo] Inserted demo financial statement lines`);
}

async function ensureDemoNotes(reportId: string): Promise<void> {
  const [existing] = await db
    .select({ id: reportNotesTable.id })
    .from(reportNotesTable)
    .where(eq(reportNotesTable.reportId, reportId))
    .limit(1);
  if (existing) return;

  type NoteRow = typeof reportNotesTable.$inferInsert;
  const notes: NoteRow[] = [
    {
      reportId,
      noteNumber: 1,
      noteType: "accounting_principles",
      title: `${DEMO_LABEL_PREFIX}Redovisningsprinciper`,
      requirementLevel: "required",
    },
    {
      reportId,
      noteNumber: 2,
      noteType: "personnel",
      title: `${DEMO_LABEL_PREFIX}Personal`,
      requirementLevel: "required",
    },
  ];
  for (const note of notes) {
    await db.insert(reportNotesTable).values(note);
  }
  console.log(`[seed-demo] Inserted demo notes`);
}

async function main() {
  console.log(
    `[seed-demo] Ensuring demo workspace exists (project ${DEMO_PROJECT_ID})...`,
  );
  const companyId = await ensureDemoCompany();
  await ensureDemoProject(companyId);
  const reportId = await ensureDemoReport(companyId);
  await ensureDemoStatementLines(reportId);
  await ensureDemoNotes(reportId);
  console.log("[seed-demo] Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-demo] FAILED:", err);
    process.exit(1);
  });
