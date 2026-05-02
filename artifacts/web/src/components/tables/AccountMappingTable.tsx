import { Fragment, useState } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ConfidenceBadge } from "@/components/badges/ConfidenceBadge";
import { EmptyState } from "@/components/states/EmptyState";

interface MappingRow {
  account: string;
  name: string;
  position: string;
  confidence: "high" | "medium" | "low";
  sourceAccounts?: string[];
}

interface AccountMappingTableProps {
  data: MappingRow[];
}

export function AccountMappingTable({ data }: AccountMappingTableProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (account: string) => {
    setExpandedRows(prev => ({ ...prev, [account]: !prev[account] }));
  };

  if (data.length === 0) {
    return <EmptyState icon="table" titleSv="Inga konton" titleEn="No accounts" descSv="Inga konton har mappats ännu." descEn="No accounts have been mapped yet." />;
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input placeholder="Sök konto eller position..." className="pl-9 bg-background" />
      </div>

      <div className="rounded-md border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="w-8 px-2 py-2"></th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Konto</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Namn</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Position</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Konfidens</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isExpanded = expandedRows[row.account];
              const hasSource = row.sourceAccounts && row.sourceAccounts.length > 0;
              return (
                <Fragment key={row.account}>
                  <tr className="border-b border-border hover:bg-muted/10 transition-colors group">
                    <td className="px-2 py-3 text-center align-middle">
                      {hasSource && (
                        <button
                          onClick={() => toggleRow(row.account)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.account}</td>
                    <td className="px-4 py-3 text-foreground">{row.name}</td>
                    <td className="px-4 py-3 text-foreground">{row.position}</td>
                    <td className="px-4 py-3">
                      <ConfidenceBadge confidence={row.confidence} />
                    </td>
                  </tr>
                  {isExpanded && hasSource && (
                    <tr className="bg-muted/10 border-b border-border">
                      <td colSpan={5} className="px-14 py-3">
                        <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Källkonton</div>
                        <div className="flex flex-wrap gap-2">
                          {row.sourceAccounts!.map(acc => (
                            <span key={acc} className="inline-flex items-center rounded-md bg-background border border-border px-2 py-1 text-xs font-mono">
                              {acc}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
