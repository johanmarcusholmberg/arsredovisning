import { useRoute, Link, useLocation } from "wouter";
import { useGetCompany, getGetCompanyQueryKey, useListReports, getListReportsQueryKey, useCreateReport } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, Building2, Plus, Calendar, Settings, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";

export function CompanyDetail() {
  const [, params] = useRoute("/companies/:companyId");
  const companyId = params?.companyId || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: company, isLoading: isCompanyLoading } = useGetCompany(companyId, {
    query: {
      enabled: !!companyId,
      queryKey: getGetCompanyQueryKey(companyId)
    }
  });

  const { data: reports, isLoading: isReportsLoading } = useListReports(companyId, {
    query: {
      enabled: !!companyId,
      queryKey: getListReportsQueryKey(companyId)
    }
  });

  const createReport = useCreateReport();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newReportYearStart, setNewReportYearStart] = useState("");
  const [newReportYearEnd, setNewReportYearEnd] = useState("");
  const [newReportFramework, setNewReportFramework] = useState<"K2" | "K3">("K2");

  const handleCreateReport = () => {
    if (!newReportYearStart || !newReportYearEnd) {
      toast({ title: "Validation Error", description: "Please provide both start and end dates.", variant: "destructive" });
      return;
    }
    
    createReport.mutate({
      companyId,
      data: {
        fiscalYearStart: newReportYearStart,
        fiscalYearEnd: newReportYearEnd,
        accountingFramework: newReportFramework
      }
    }, {
      onSuccess: (newReport) => {
        toast({ title: "Report created", description: "New annual report has been created." });
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey(companyId) });
        setIsDialogOpen(false);
        setLocation(`/reports/${newReport.id}`);
      },
      onError: () => {
        toast({ title: "Error", description: "Could not create the report.", variant: "destructive" });
      }
    });
  };

  if (isCompanyLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 col-span-1" />
          <Skeleton className="h-64 col-span-2" />
        </div>
      </div>
    );
  }

  if (!company) {
    return <div>Company not found.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="font-mono bg-muted/50">{company.orgNumber}</Badge>
            <Badge variant="secondary">{company.legalForm}</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            {company.name}
          </h1>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 h-11 px-6 shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> New Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Annual Report</DialogTitle>
              <DialogDescription>
                Start a new annual report for {company.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input 
                    type="date" 
                    value={newReportYearStart} 
                    onChange={(e) => setNewReportYearStart(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input 
                    type="date" 
                    value={newReportYearEnd} 
                    onChange={(e) => setNewReportYearEnd(e.target.value)} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Accounting Framework</Label>
                <Select value={newReportFramework} onValueChange={(v: "K2" | "K3") => setNewReportFramework(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="K2">K2 (Mindre företag)</SelectItem>
                    <SelectItem value="K3">K3 (Huvudregelverket)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateReport} disabled={createReport.isPending}>
                {createReport.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 shadow-sm h-fit">
          <CardHeader className="bg-muted/20 pb-4 border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" /> Company Info
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Address</div>
              <div className="mt-1">
                {company.address ? (
                  <>
                    <div>{company.address}</div>
                    <div>{company.zipCode} {company.city}</div>
                  </>
                ) : (
                  <span className="text-muted-foreground italic">No address provided</span>
                )}
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-muted-foreground">Framework</div>
              <div className="mt-1">{company.accountingFramework}</div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-muted-foreground">Default Fiscal Year</div>
              <div className="mt-1 font-mono">{company.fiscalYearStart} to {company.fiscalYearEnd}</div>
            </div>
          </CardContent>
          <CardFooter className="border-t bg-muted/10 p-4">
             <Button variant="ghost" className="w-full text-muted-foreground">Edit Company Details</Button>
          </CardFooter>
        </Card>

        <div className="col-span-1 md:col-span-2 space-y-4">
          <h2 className="text-xl font-bold tracking-tight mb-4">Annual Reports</h2>
          
          {isReportsLoading ? (
             <div className="space-y-4">
               <Skeleton className="h-24 w-full" />
               <Skeleton className="h-24 w-full" />
             </div>
          ) : reports && reports.length > 0 ? (
            <div className="grid gap-4">
              {reports.map((report) => (
                <Card key={report.id} className="shadow-sm hover:border-primary/50 transition-colors group">
                  <Link href={`/reports/${report.id}`}>
                    <div className="p-5 flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${report.status === 'complete' ? 'bg-green-500/10 text-green-600' : 'bg-primary/10 text-primary'}`}>
                          <FileText className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg flex items-center gap-2">
                            {new Date(report.fiscalYearEnd).getFullYear()} Report
                            <Badge variant={report.status === 'complete' ? 'default' : 'secondary'} className={report.status === 'complete' ? 'bg-green-500 hover:bg-green-600' : ''}>
                              {report.status.replace("_", " ").toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(report.fiscalYearStart).toLocaleDateString()} — {new Date(report.fiscalYearEnd).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <div className="text-sm font-medium">{report.completionPercent}%</div>
                          <div className="w-24 h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${report.completionPercent}%` }} />
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="group-hover:bg-primary/10 group-hover:text-primary">
                          <ArrowRight className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </Link>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed shadow-none bg-transparent">
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 opacity-50" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">No reports yet</h3>
                <p className="mt-1 mb-6">Create the first annual report for this company.</p>
                <Button onClick={() => setIsDialogOpen(true)} variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Create First Report
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
