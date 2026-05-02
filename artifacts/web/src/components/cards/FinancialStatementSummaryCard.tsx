import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/badges/StatusBadge";

interface FinancialStatementSummaryCardProps {
  name: string;
  totalAmount: number;
  period: string;
  status: "draft" | "done" | "warning" | "error" | "in_progress";
}

export function FinancialStatementSummaryCard({ name, totalAmount, period, status }: FinancialStatementSummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sm text-muted-foreground">{name}</h3>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
            {totalAmount.toLocaleString("sv-SE")} kr
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{period}</p>
      </CardContent>
    </Card>
  );
}
