import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface WarningCardProps {
  message: string;
}

export function WarningCard({ message }: WarningCardProps) {
  return (
    <Card className="bg-amber-50 border-amber-200">
      <CardContent className="p-4 flex items-start gap-3">
        <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm font-medium text-amber-900">{message}</p>
      </CardContent>
    </Card>
  );
}
