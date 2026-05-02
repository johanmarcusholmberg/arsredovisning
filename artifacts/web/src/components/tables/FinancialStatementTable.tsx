import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { NoteReferenceBadge } from "@/components/badges/NoteReferenceBadge";
import { EmptyState } from "@/components/states/EmptyState";

interface FinRow {
  id: string;
  label: string;
  amount: number;
  noteRef?: number;
  isTotal?: boolean;
  calculationRows?: { label: string; amount: number }[];
}

interface FinancialStatementTableProps {
  data: FinRow[];
}

function formatAmount(amount: number) {
  return amount.toLocaleString("sv-SE") + " kr";
}

export function FinancialStatementTable({ data }: FinancialStatementTableProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (data.length === 0) {
    return <EmptyState icon="chart" titleSv="Ingen data" titleEn="No data" descSv="Finns inga finansiella poster." descEn="No financial items available." />;
  }

  return (
    <div className="rounded-md border border-border overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b border-border">
            <th className="w-8 px-2 py-2"></th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Post</th>
            <th className="text-center px-4 py-2 font-medium text-muted-foreground w-24">Not</th>
            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Belopp</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const isExpanded = expandedRows[row.id];
            const hasCalc = row.calculationRows && row.calculationRows.length > 0;
            return (
              <Fragment key={row.id}>
                <tr className={`border-b border-border hover:bg-muted/10 transition-colors ${row.isTotal ? "bg-muted/5 font-semibold" : ""}`}>
                  <td className="px-2 py-3 text-center align-middle">
                    {hasCalc && (
                      <button
                        onClick={() => toggleRow(row.id)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">{row.label}</td>
                  <td className="px-4 py-3 text-center">
                    {row.noteRef && <NoteReferenceBadge noteNumber={row.noteRef} />}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono text-xs ${row.amount < 0 ? "text-red-700" : "text-foreground"}`}>
                    {formatAmount(row.amount)}
                  </td>
                </tr>
                {isExpanded && hasCalc && (
                  <tr className="bg-muted/10 border-b border-border">
                    <td colSpan={4} className="px-14 py-3">
                      <table className="w-full text-xs">
                        <tbody>
                          {row.calculationRows!.map((calc, i) => (
                            <tr key={i}>
                              <td className="py-1 text-muted-foreground">{calc.label}</td>
                              <td className={`py-1 text-right font-mono ${calc.amount < 0 ? "text-red-700/80" : "text-muted-foreground"}`}>
                                {formatAmount(calc.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
