import { useState } from "react";
import { demoData } from "@/data/demoData";
import { NoteReferenceBadge } from "@/components/badges/NoteReferenceBadge";
import { useLanguage } from "@/contexts/LanguageContext";

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
      <table className="w-full text-sm">
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
  );
}

export function StatementsSection() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"income" | "balance">("income");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-muted/30 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("income")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "income" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("demo.statements.tab.income")}
        </button>
        <button
          onClick={() => setActiveTab("balance")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "balance" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("demo.statements.tab.balance")}
        </button>
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
    </div>
  );
}
