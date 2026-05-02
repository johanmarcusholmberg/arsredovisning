import { EmptyState } from "@/components/states/EmptyState";
import { LockedFeatureTooltip } from "@/components/badges/LockedFeatureTooltip";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";

interface UserRoleRow {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: "active" | "invited";
}

interface UsersRolesTableProps {
  data: UserRoleRow[];
  isLocked?: boolean;
}

export function UsersRolesTable({ data, isLocked = false }: UsersRolesTableProps) {
  if (data.length === 0) {
    return <EmptyState icon="users" titleSv="Inga användare" titleEn="No users" descSv="Inga användare inbjudna." descEn="No users invited yet." />;
  }

  return (
    <div className="rounded-md border border-border overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b border-border">
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Användare</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground w-32">Roll</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground w-32">Status</th>
            <th className="w-16 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} className="border-b border-border hover:bg-muted/10 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-medium text-xs">
                      {row.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                  {row.role === "admin" ? "Administratör" : row.role === "editor" ? "Redigerare" : "Granskare"}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  row.status === "active" 
                    ? "bg-green-50 text-green-700 border border-green-200" 
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {row.status === "active" ? "Aktiv" : "Inbjuden"}
                </span>
              </td>
              <td className="px-2 py-3 text-center">
                {isLocked ? (
                  <LockedFeatureTooltip>
                    <Button variant="ghost" size="icon" className="size-8 opacity-50 pointer-events-none">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </LockedFeatureTooltip>
                ) : (
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontal className="size-4" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
