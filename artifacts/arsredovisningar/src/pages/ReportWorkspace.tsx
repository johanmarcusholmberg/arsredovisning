import { useRoute, Link } from "wouter";
import { useGetReport, getGetReportQueryKey, useUpdateReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowLeft, CheckCircle2, ChevronRight, BarChart3, Calculator, AlignLeft, PenTool, LayoutDashboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { WorkflowProgress } from "@/components/WorkflowProgress";

const SECTIONS = [
  { id: "förvaltningsberättelse", title: "Förvaltningsberättelse", icon: AlignLeft, desc: "Management report and overview" },
  { id: "resultaträkning", title: "Resultaträkning", icon: BarChart3, desc: "Income statement" },
  { id: "balansräkning", title: "Balansräkning", icon: Calculator, desc: "Balance sheet" },
  { id: "noter", title: "Noter", icon: FileText, desc: "Accounting notes and disclosures" },
  { id: "underskrifter", title: "Underskrifter", icon: PenTool, desc: "Signatures" },
];

export function ReportWorkspace() {
  const [, params] = useRoute("/reports/:reportId");
  const reportId = params?.reportId || "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: report, isLoading } = useGetReport(reportId, {
    query: {
      enabled: !!reportId,
      queryKey: getGetReportQueryKey(reportId)
    }
  });

  const updateReport = useUpdateReport();

  const handleStatusChange = (newStatus: "draft" | "in_progress" | "complete" | "exported") => {
    updateReport.mutate({
      reportId,
      data: { status: newStatus }
    }, {
      onSuccess: () => {
        toast({ title: "Status updated", description: `Report status changed to ${newStatus.replace("_", " ")}.` });
        queryClient.invalidateQueries({ queryKey: getGetReportQueryKey(reportId) });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-8 w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-96 col-span-2" />
          <Skeleton className="h-96 col-span-1" />
        </div>
      </div>
    );
  }

  if (!report) {
    return <div>Report not found.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/companies/${report.companyId}`} className="hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Back to {report.companyName}
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono">{report.accountingFramework}</Badge>
          <Badge variant={report.status === 'complete' ? 'default' : 'secondary'} className={report.status === 'complete' ? 'bg-green-500' : ''}>
            {report.status.replace("_", " ").toUpperCase()}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Annual Report {new Date(report.fiscalYearEnd).getFullYear()}</h1>
          <p className="text-muted-foreground mt-1">
            Fiscal year: {new Date(report.fiscalYearStart).toLocaleDateString()} — {new Date(report.fiscalYearEnd).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {report.status !== "complete" && (
            <Button onClick={() => handleStatusChange("complete")} variant="outline" className="border-green-500/30 text-green-600 hover:bg-green-500/10">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Complete
            </Button>
          )}
          <Button asChild>
            <Link href={`/reports/${report.id}/summary`}>
              <LayoutDashboard className="mr-2 h-4 w-4" /> View Summary
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-2">
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-xl font-bold tracking-tight mb-4">Sections</h2>
          <div className="grid gap-3">
            {SECTIONS.map((section, idx) => (
              <Card key={section.id} className="hover:border-primary/50 transition-colors shadow-sm cursor-pointer group">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <section.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{section.title}</h3>
                      <p className="text-sm text-muted-foreground">{section.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Mock completion status for UI */}
                    {idx < 2 ? (
                       <Badge variant="default" className="bg-green-500/10 text-green-700 hover:bg-green-500/20 border-transparent">Completed</Badge>
                    ) : (
                       <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-transparent">Needs Review</Badge>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
        
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg">9-Step Workflow</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <WorkflowProgress
                currentStepId="import"
                completedStepIds={[]}
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
             <CardHeader className="pb-3">
               <CardTitle className="text-lg">Quick Actions</CardTitle>
             </CardHeader>
             <CardContent className="space-y-2">
               <Button variant="outline" className="w-full justify-start" disabled>
                 <FileText className="mr-2 h-4 w-4" /> Download Draft PDF
               </Button>
               <Button variant="outline" className="w-full justify-start" disabled>
                 <PenTool className="mr-2 h-4 w-4" /> Send for Signature
               </Button>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
