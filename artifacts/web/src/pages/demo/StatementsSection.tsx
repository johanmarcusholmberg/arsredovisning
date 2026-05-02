import { useState } from "react";
import { demoData } from "@/data/demoData";
import { NoteReferenceBadge } from "@/components/badges/NoteReferenceBadge";
import { useLanguage } from "@/hooks/useLanguage";

function formatAmount(amount: number): string {
  return amount.toLocaleString("sv-SE") + " kr";
}

interface StatRow {
  label: string;
  amount: number;
  noteRef?: number;
  isTotal?: boolean;
  isSummary?: boolean;
}

function StatTable({ rows, title, showCalcLabel }: { rows: StatRow[]; title: string; showCalcLabel: string }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="bg-muted/40 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="bg-muted/20 border-b border-border">
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Post</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Belopp (kr)</th>
              <th className="text-center px-4 py-2 text-xs font-semibold text-muted-foreground">Not</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-border last:border-0 ${
                  row.isSummary
                    ? "bg-primary/5 font-bold"
                    : row.isTotal
                    ? "bg-muted/30 font-semibold"
                    : "hover:bg-muted/10"
                } transition-colors`}
              >
                <td className="px-4 py-2.5">
                  <span className={row.isSummary ? "uppercase tracking-wide text-xs" : "text-sm"}>
                    {row.label}
                  </span>
                  {row.isTotal && !row.isSummary && (
                    <p className="text-xs text-muted-foreground mt-0.5">{showCalcLabel}</p>
                  )}
                </td>
                <td className={`px-4 py-2.5 text-right font-mono text-xs ${row.amount < 0 ? "text-red-700" : "text-foreground"}`}>
                  {formatAmount(row.amount)}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {row.noteRef && <NoteReferenceBadge noteNumber={row.noteRef} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type TabKey = "income" | "balance" | "cashflow" | "structure";

function PlaceholderTab({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/10 px-6 py-12 text-center">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs mx-auto">{desc}</p>
    </div>
  );
}

export function StatementsSection() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabKey>("income");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "income", label: t("demo.statements.tab.income") },
    { key: "balance", label: t("demo.statements.tab.balance") },
    { key: "cashflow", label: t("demo.statements.tab.cashflow") },
    { key: "structure", label: t("demo.statements.tab.structure") },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-1 bg-muted/30 rounded-lg p-1 w-max min-w-full sm:w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t("demo.statements.notice")}</p>

      {activeTab === "income" && (
        <StatTable
          rows={demoData.incomeStatement}
          title={t("demo.statements.income.title")}
          showCalcLabel={t("demo.statements.calculation.suffix")}
        />
      )}

      {activeTab === "balance" && (
        <div className="space-y-4">
          <StatTable
            rows={demoData.balanceSheet.assets}
            title={t("demo.statements.assets.title")}
            showCalcLabel={t("demo.statements.calculation.suffix")}
          />
          <StatTable
            rows={demoData.balanceSheet.equityAndLiabilities}
            title={t("demo.statements.equity.title")}
            showCalcLabel={t("demo.statements.calculation.suffix")}
          />
        </div>
      )}

      {activeTab === "cashflow" && (
        <PlaceholderTab
          title={t("demo.statements.cashflow.title")}
          desc={t("demo.statements.cashflow.desc")}
        />
      )}

      {activeTab === "structure" && (
        <PlaceholderTab
          title={t("demo.statements.structure.title")}
          desc={t("demo.statements.structure.desc")}
        />
      )}
    </div>
  );
}
