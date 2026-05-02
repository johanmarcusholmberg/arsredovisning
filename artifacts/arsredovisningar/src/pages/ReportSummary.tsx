import { useRoute, Link } from "wouter";
import { useGetReportSummary, getGetReportSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Circle, AlertCircle, FileDown, Edit3 } from "lucide-react";

export function ReportSummary() {
  const [, params] = useRoute("/reports/:reportId/summary");
  const reportId = params?.reportId || "";

  const { data: summary, isLoading } = useGetReportSummary(reportId, {
    query: {
      enabled: !!reportId,
      queryKey: getGetReportSummaryQueryKey(reportId)
    }
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Report Summary</h1>
          <p className="text-muted-foreground mt-1 text-lg">{summary.companyName}</p>
        </div>
        <Button className="shadow-sm" asChild>
          <Link href={`/reports/${reportId}/preview`}>
            <FileDown className="mr-2 h-4 w-4" /> Export Report
          </Link>
        </Button>
      </div>

      <Card className="bg-primary text-primary-foreground border-primary-border shadow-md">
        <CardContent className="p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">
              {summary.completionPercent === 100 ? "Ready for Export" : "In Progress"}
            </h2>
            <p className="text-primary-foreground/80">
              {summary.completionPercent === 100 
                ? "All sections are completed and the report is ready to be exported or signed."
                : `You have completed ${summary.sections.filter(s => s.completed).length} out of ${summary.sections.length} required sections.`}
            </p>
          </div>
          <div className="shrink-0 flex items-center justify-center w-32 h-32 rounded-full border-4 border-primary-foreground/20 relative">
            <div className="absolute inset-0 rounded-full border-4 border-primary-foreground" 
                 style={{ clipPath: `polygon(0 0, 100% 0, 100% ${summary.completionPercent}%, 0 ${summary.completionPercent}%)`, transform: 'rotate(-90deg)' }} />
            <span className="text-4xl font-bold">{summary.completionPercent}%</span>
          </div>
        </CardContent>
      </Card>

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
