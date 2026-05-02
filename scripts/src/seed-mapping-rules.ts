/**
 * seed-mapping-rules.ts
 *
 * Inserts the canonical Swedish BAS account-range → K2/K3 report-line rules
 * into the `mapping_rules` table.
 *
 * Idempotent — by default the script does nothing if the table already
 * contains rows. Pass `--force` to truncate and reseed.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run seed-mapping-rules
 *   pnpm --filter @workspace/scripts run seed-mapping-rules -- --force
 */

import { db, mappingRulesTable } from "@workspace/db";

interface Rule {
  accountRangeStart: number;
  accountRangeEnd: number;
  reportLine: string;
  reportLineLabel: string;
  confidence: "high" | "medium" | "low";
  noteImpactFlag: boolean;
  noteType?: string;
  priority: number;
}

const BAS_RULES: Rule[] = [
  { accountRangeStart: 1000, accountRangeEnd: 1099, reportLine: "BS_1000_IntangibleAssets", reportLineLabel: "Immateriella anläggningstillgångar", confidence: "high", noteImpactFlag: true, noteType: "fixed_assets", priority: 10 },
  { accountRangeStart: 1100, accountRangeEnd: 1299, reportLine: "BS_1100_TangibleAssets", reportLineLabel: "Materiella anläggningstillgångar", confidence: "high", noteImpactFlag: true, noteType: "fixed_assets", priority: 10 },
  { accountRangeStart: 1300, accountRangeEnd: 1399, reportLine: "BS_1300_FinancialAssets", reportLineLabel: "Finansiella anläggningstillgångar", confidence: "high", noteImpactFlag: false, priority: 10 },
  { accountRangeStart: 1400, accountRangeEnd: 1499, reportLine: "BS_1400_Inventories", reportLineLabel: "Varulager m.m.", confidence: "high", noteImpactFlag: false, priority: 5 },
  { accountRangeStart: 1500, accountRangeEnd: 1699, reportLine: "BS_1500_CurrentReceivables", reportLineLabel: "Kortfristiga fordringar", confidence: "high", noteImpactFlag: false, priority: 10 },
  { accountRangeStart: 1700, accountRangeEnd: 1799, reportLine: "BS_1700_ShortTermInvestments", reportLineLabel: "Kortfristiga placeringar", confidence: "high", noteImpactFlag: false, priority: 10 },
  { accountRangeStart: 1800, accountRangeEnd: 1999, reportLine: "BS_1800_CashAndBank", reportLineLabel: "Kassa och bank", confidence: "high", noteImpactFlag: false, priority: 10 },
  { accountRangeStart: 2000, accountRangeEnd: 2099, reportLine: "BS_2000_Equity", reportLineLabel: "Eget kapital", confidence: "high", noteImpactFlag: true, noteType: "equity", priority: 10 },
  { accountRangeStart: 2100, accountRangeEnd: 2199, reportLine: "BS_2100_UntaxedReserves", reportLineLabel: "Obeskattade reserver", confidence: "high", noteImpactFlag: false, priority: 10 },
  { accountRangeStart: 2200, accountRangeEnd: 2299, reportLine: "BS_2200_Provisions", reportLineLabel: "Avsättningar", confidence: "high", noteImpactFlag: false, priority: 10 },
  { accountRangeStart: 2300, accountRangeEnd: 2499, reportLine: "BS_2300_LongTermLiabilities", reportLineLabel: "Långfristiga skulder", confidence: "high", noteImpactFlag: true, noteType: "loans", priority: 10 },
  { accountRangeStart: 2500, accountRangeEnd: 2999, reportLine: "BS_2500_CurrentLiabilities", reportLineLabel: "Kortfristiga skulder", confidence: "high", noteImpactFlag: false, priority: 10 },
  { accountRangeStart: 3000, accountRangeEnd: 3999, reportLine: "IS_3000_NetRevenue", reportLineLabel: "Nettoomsättning", confidence: "high", noteImpactFlag: false, priority: 10 },
  { accountRangeStart: 4000, accountRangeEnd: 4999, reportLine: "IS_4000_COGS", reportLineLabel: "Råvaror och förnödenheter / Handelsvaror", confidence: "high", noteImpactFlag: false, priority: 10 },
  { accountRangeStart: 5000, accountRangeEnd: 6999, reportLine: "IS_5000_ExternalCosts", reportLineLabel: "Övriga externa kostnader", confidence: "high", noteImpactFlag: false, priority: 10 },
  { accountRangeStart: 7000, accountRangeEnd: 7699, reportLine: "IS_7000_PersonnelCosts", reportLineLabel: "Personalkostnader", confidence: "high", noteImpactFlag: true, noteType: "personnel", priority: 10 },
  { accountRangeStart: 7700, accountRangeEnd: 7899, reportLine: "IS_7700_Depreciation", reportLineLabel: "Avskrivningar och nedskrivningar", confidence: "high", noteImpactFlag: true, noteType: "fixed_assets", priority: 10 },
  { accountRangeStart: 7900, accountRangeEnd: 7999, reportLine: "IS_7900_OtherOperatingCosts", reportLineLabel: "Övriga rörelsekostnader", confidence: "high", noteImpactFlag: false, priority: 10 },
  { accountRangeStart: 8000, accountRangeEnd: 8399, reportLine: "IS_8000_FinancialItems", reportLineLabel: "Finansiella intäkter och kostnader", confidence: "medium", noteImpactFlag: false, priority: 10 },
  { accountRangeStart: 8400, accountRangeEnd: 8799, reportLine: "IS_8400_Appropriations", reportLineLabel: "Bokslutsdispositioner", confidence: "medium", noteImpactFlag: false, priority: 10 },
  { accountRangeStart: 8800, accountRangeEnd: 8999, reportLine: "IS_8800_Tax", reportLineLabel: "Skatter", confidence: "high", noteImpactFlag: false, priority: 10 },
];

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const existing = await db.select({ id: mappingRulesTable.id }).from(mappingRulesTable).limit(1);

  if (existing.length > 0 && !force) {
    console.log(
      `mapping_rules already contains data — skipping. Pass --force to truncate and reseed.`,
    );
    process.exit(0);
  }

  if (force && existing.length > 0) {
    console.log("Truncating existing mapping_rules…");
    await db.delete(mappingRulesTable);
  }

  console.log(`Seeding ${BAS_RULES.length} BAS rules…`);
  await db.insert(mappingRulesTable).values(
    BAS_RULES.map((r) => ({
      accountRangeStart: r.accountRangeStart,
      accountRangeEnd: r.accountRangeEnd,
      reportLine: r.reportLine,
      reportLineLabel: r.reportLineLabel,
      accountingFramework: null,
      confidence: r.confidence,
      noteImpactFlag: r.noteImpactFlag,
      noteType: r.noteType ?? null,
      priority: r.priority,
      isActive: true,
    })),
  );

  console.log(`Done — ${BAS_RULES.length} rules inserted.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
