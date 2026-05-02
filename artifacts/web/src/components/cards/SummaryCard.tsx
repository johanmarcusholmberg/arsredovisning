import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface SummaryCardProps {
  label: string;
  value: string | number;
  delta?: string;
  icon?: ReactNode;
}

export function SummaryCard({ label, value, delta, icon }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-x-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{value}</h2>
          {delta && <span className="text-sm font-medium text-muted-foreground">{delta}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
