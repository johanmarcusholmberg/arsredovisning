import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Building, FileText, CheckCircle2, Clock, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Dashboard() {
  const { data: summary, isLoading, isError } = useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey()
    }
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-lg">Overview of your client annual reports.</p>
        </div>
        <Button asChild className="shrink-0 h-11 px-6 shadow-sm">
          <Link href="/companies/new">
            <Plus className="mr-2 h-4 w-4" /> New Company
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-1/3 mb-1" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError || !summary ? (
        <div className="bg-destructive/10 text-destructive p-6 rounded-lg border border-destructive/20 flex flex-col items-center justify-center text-center">
          <h3 className="font-bold text-lg mb-2">Error loading dashboard</h3>
          <p>Could not fetch summary data. Please try refreshing.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-sm hover:shadow transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Companies</CardTitle>
                <Building className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono tracking-tight">{summary.totalCompanies}</div>
                <p className="text-xs text-muted-foreground mt-1">Active clients</p>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm hover:shadow transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Reports</CardTitle>
                <FileText className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono tracking-tight">{summary.totalReports}</div>
                <p className="text-xs text-muted-foreground mt-1">Created this year</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono tracking-tight">{summary.reportsInProgress}</div>
                <p className="text-xs text-muted-foreground mt-1">Drafting & Reviewing</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono tracking-tight">{summary.reportsComplete}</div>
                <p className="text-xs text-muted-foreground mt-1">Ready for signature</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-bold tracking-tight mb-4">Recent Reports</h2>
            <Card className="shadow-sm overflow-hidden">
              {summary.recentReports && summary.recentReports.length > 0 ? (
                <div className="divide-y divide-border">
                  {summary.recentReports.map(report => (
                    <Link key={report.id} href={`/reports/${report.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group cursor-pointer block">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold">{report.companyName}</p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {new Date(report.fiscalYearStart).toLocaleDateString('sv-SE')} – {new Date(report.fiscalYearEnd).toLocaleDateString('sv-SE')} • {report.accountingFramework}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <div className="text-sm font-medium">{report.completionPercent}% Complete</div>
                          <div className="text-xs text-muted-foreground">
                            {report.sectionsCompleted}/{report.sectionsTotal} sections
                          </div>
                        </div>
                        <Badge variant={report.status === "complete" || report.status === "exported" ? "default" : "secondary"} className={report.status === 'complete' ? 'bg-green-500 hover:bg-green-600' : ''}>
                          {report.status.replace("_", " ").toUpperCase()}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 opacity-50" />
                  </div>
                  <h3 className="font-semibold text-lg text-foreground">No reports found</h3>
                  <p className="mt-1 mb-6">Create a company to start drafting annual reports.</p>
                  <Button asChild variant="outline">
                    <Link href="/companies/new">Create First Company</Link>
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
