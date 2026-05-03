import { useRoute, Link } from "wouter";
import {
  useGetReportSummary,
  getGetReportSummaryQueryKey,
  useGetReport,
  getGetReportQueryKey,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Circle, AlertCircle, FileDown, Edit3 } from "lucide-react";
import { ConnectedReportSummaryCard } from "@/components/report/ReportSummaryCard";

export function ReportSummary() {
  const [, params] = useRoute("/reports/:reportId/summary");
  const reportId = params?.reportId || "";

  const { data: summary, isLoading } = useGetReportSummary(reportId, {
    query: {
      enabled: !!reportId,
      queryKey: getGetReportSummaryQueryKey(reportId)
    }
  });

  const { data: report } = useGetReport(reportId, {
    query: {
      enabled: !!reportId,
      queryKey: getGetReportQueryKey(reportId),
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!summary) return <div>Summary not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href={`/reports/${reportId}`} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to Editor
        </Link>
      </div>

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Report Summary</h1>
        <Button className="shadow-sm" asChild>
          <Link href={`/reports/${reportId}/preview`}>
            <FileDown className="mr-2 h-4 w-4" /> Export Report
          </Link>
        </Button>
      </div>

      {report ? (
        <ConnectedReportSummaryCard
          reportId={reportId}
          report={report}
          variant="hero"
          trailing={
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="tabular-nums">
                {summary.completionPercent}% ·{" "}
                {summary.sections.filter((s) => s.completed).length}/
                {summary.sections.length} sections
              </span>
              <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${summary.completionPercent}%` }}
                />
              </div>
            </div>
          }
        />
      ) : (
        <Skeleton className="h-64 w-full" />
      )}

      <h3 className="text-xl font-bold tracking-tight mt-8 mb-4">Section Breakdown</h3>
      
      <div className="grid gap-4">
        {summary.sections.map((section) => (
          <Card key={section.key} className={section.completed ? 'bg-muted/30 border-muted' : 'border-primary/20'}>
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {section.completed ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground shrink-0" />
                )}
                <div>
                  <h4 className={`font-semibold text-lg ${section.completed ? 'text-muted-foreground' : ''}`}>
                    {section.label}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={section.completed ? "outline" : "secondary"} className="text-xs font-mono">
                      {section.completedFields} / {section.requiredFields} fields
                    </Badge>
                    {!section.completed && section.completedFields > 0 && (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Action required
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/reports/${reportId}`}>
                  {section.completed ? 'Review' : 'Continue'} <Edit3 className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
