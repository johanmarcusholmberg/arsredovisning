import { EmptyState } from "@/components/states/EmptyState";

interface AuditLogRow {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  section: string;
  detail: string;
}

interface AuditLogTableProps {
  data: AuditLogRow[];
}

export function AuditLogTable({ data }: AuditLogTableProps) {
  if (data.length === 0) {
    return <EmptyState icon="history" titleSv="Ingen historik" titleEn="No history" descSv="Inga händelser loggade ännu." descEn="No events logged yet." />;
  }

  return (
    <div className="rounded-md border border-border overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b border-border">
            <th className="text-left px-4 py-2 font-medium text-muted-foreground w-40">Tidpunkt</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground w-48">Användare</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground w-32">Åtgärd</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground w-32">Sektion</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Detalj</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} className="border-b border-border hover:bg-muted/10 transition-colors">
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{row.timestamp}</td>
              <td className="px-4 py-3 text-foreground font-medium">{row.user}</td>
              <td className="px-4 py-3 text-foreground">
                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {row.action}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{row.section}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
