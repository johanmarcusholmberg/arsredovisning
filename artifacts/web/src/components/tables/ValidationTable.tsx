import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { StatusBadge } from "@/components/badges/StatusBadge";
import { EmptyState } from "@/components/states/EmptyState";

interface ValidationRow {
  id: string;
  severity: "warning" | "error";
  code: string;
  description: string;
  sectionLink: string;
  status: "draft" | "done" | "warning" | "error" | "in_progress";
  detail?: string;
}

interface ValidationTableProps {
  data: ValidationRow[];
}

export function ValidationTable({ data }: ValidationTableProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (data.length === 0) {
    return <EmptyState icon="check" titleSv="Inga valideringsfel" titleEn="No validation errors" descSv="Allt ser bra ut." descEn="Everything looks good." />;
  }

  return (
    <div className="rounded-md border border-border overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b border-border">
            <th className="w-8 px-2 py-2"></th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground w-12">Typ</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground w-24">Kod</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Beskrivning</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground w-32">Status</th>
            <th className="w-12 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const isExpanded = expandedRows[row.id];
            const isError = row.severity === "error";
            const Icon = isError ? XCircle : AlertTriangle;
            const iconClass = isError ? "text-red-500" : "text-amber-500";

            return (
              <Fragment key={row.id}>
                <tr className="border-b border-border hover:bg-muted/10 transition-colors">
                  <td className="px-2 py-3 text-center align-middle">
                    {row.detail && (
                      <button
                        onClick={() => toggleRow(row.id)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Icon className={`size-4 ${iconClass}`} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.code}</td>
                  <td className="px-4 py-3 text-foreground">{row.description}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <Link href={row.sectionLink} className="p-1.5 inline-block rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <ArrowRight className="size-4" />
                    </Link>
                  </td>
                </tr>
                {isExpanded && row.detail && (
                  <tr className="bg-muted/10 border-b border-border">
                    <td colSpan={6} className="px-14 py-3 text-sm text-muted-foreground">
                      {row.detail}
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
