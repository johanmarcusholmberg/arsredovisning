import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/badges/StatusBadge";

interface StatusCardProps {
  title: string;
  status: "draft" | "done" | "warning" | "error" | "in_progress";
  description?: string;
}

export function StatusCard({ title, status, description }: StatusCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      {description && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      )}
    </Card>
  );
}
