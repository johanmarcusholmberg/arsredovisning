import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/badges/StatusBadge";
import { EmptyState } from "@/components/states/EmptyState";

interface NoteRow {
  number: number;
  title: string;
  status: "draft" | "done" | "warning" | "error" | "in_progress";
  isRequired: boolean;
}

interface NotesTableProps {
  data: NoteRow[];
}

export function NotesTable({ data }: NotesTableProps) {
  if (data.length === 0) {
    return <EmptyState icon="file" titleSv="Inga noter" titleEn="No notes" descSv="Inga noter har skapats ännu." descEn="No notes have been created yet." />;
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input placeholder="Sök noter..." className="pl-9 bg-background" />
      </div>

      <div className="rounded-md border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-center px-4 py-2 font-medium text-muted-foreground w-16">Nr</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Titel</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground w-28">Krav</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground w-32">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.number} className="border-b border-border hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3 text-center font-medium text-muted-foreground">{row.number}</td>
                <td className="px-4 py-3 text-foreground font-medium">{row.title}</td>
                <td className="px-4 py-3">
                  {row.isRequired ? (
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
                      OBLIGATORISK
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                      VALFRI
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
