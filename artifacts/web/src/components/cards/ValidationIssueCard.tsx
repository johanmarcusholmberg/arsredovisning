import { AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ValidationIssueCardProps {
  severity: "warning" | "error";
  code: string;
  description: string;
  suggestedFix?: string;
}

export function ValidationIssueCard({ severity, code, description, suggestedFix }: ValidationIssueCardProps) {
  const isError = severity === "error";
  const Icon = isError ? XCircle : AlertTriangle;
  const bgClass = isError ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200";
  const textClass = isError ? "text-red-900" : "text-amber-900";
  const iconClass = isError ? "text-red-600" : "text-amber-600";
  const codeClass = isError ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";

  return (
    <Card className={bgClass}>
      <CardContent className="p-4 flex gap-3">
        <Icon className={`size-5 shrink-0 mt-0.5 ${iconClass}`} />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${codeClass}`}>{code}</span>
            <span className={`text-sm font-medium ${textClass}`}>{description}</span>
          </div>
          {suggestedFix && (
            <p className={`text-sm ${isError ? "text-red-700" : "text-amber-700"}`}>{suggestedFix}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
