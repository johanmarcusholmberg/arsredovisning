import { useRoute, Link, useLocation } from "wouter";
import {
  useGetCompany,
  getGetCompanyQueryKey,
  useListReports,
  getListReportsQueryKey,
  useCreateReport,
  type AnnualReportStatus,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Building2,
  Plus,
  Calendar,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/useLanguage";
import type { StringKey } from "@/i18n/strings";

const STATUS_KEY: Record<AnnualReportStatus, StringKey> = {
  draft: "report.status.draft",
  in_progress: "report.status.in_progress",
  complete: "report.status.complete",
  exported: "report.status.exported",
};

export function CompanyDetail() {
  const [, params] = useRoute("/companies/:companyId");
  const companyId = params?.companyId || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();

  const { data: company, isLoading: isCompanyLoading } = useGetCompany(
    companyId,
    {
      query: {
        enabled: !!companyId,
        queryKey: getGetCompanyQueryKey(companyId),
      },
    },
  );

  const { data: reports, isLoading: isReportsLoading } = useListReports(
    companyId,
    {
      query: {
        enabled: !!companyId,
        queryKey: getListReportsQueryKey(companyId),
      },
    },
  );

  const createReport = useCreateReport();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState<string>(String(currentYear - 1));

  const computeReportDates = (
    year: number,
  ): { start: string; end: string } | null => {
    const startMMDD = company?.fiscalYearStart ?? "01-01";
    const endMMDD = company?.fiscalYearEnd ?? "12-31";
    if (!/^\d{2}-\d{2}$/.test(startMMDD) || !/^\d{2}-\d{2}$/.test(endMMDD))
      return null;
    const startYear = year;
    const endYear = startMMDD <= endMMDD ? year : year + 1;
    return { start: `${startYear}-${startMMDD}`, end: `${endYear}-${endMMDD}` };
  };

  const handleCreateReport = () => {
    const yearNum = parseInt(fiscalYear, 10);
    if (!fiscalYear || Number.isNaN(yearNum)) {
      toast({
        title: t("company.detail.create_dialog.validation_year_title"),
        description: t("company.detail.create_dialog.validation_year_desc"),
        variant: "destructive",
      });
      return;
    }
    const dates = computeReportDates(yearNum);
    if (!dates || !company) {
      toast({
        title: t("company.detail.create_dialog.invalid_period_title"),
        description: t("company.detail.create_dialog.invalid_period_desc"),
        variant: "destructive",
      });
      return;
    }

    createReport.mutate(
      {
        companyId,
        data: {
          fiscalYearStart: dates.start,
          fiscalYearEnd: dates.end,
          accountingFramework: company.accountingFramework,
        },
      },
      {
        onSuccess: (newReport) => {
          // P4-4: first-report funnel event. Local-storage gated so we
          // only fire it the first time the user creates a report.
          try {
            if (
              typeof window !== "undefined" &&
              !window.localStorage.getItem("ar.firstReportTracked")
            ) {
              void import("@/lib/track").then(({ track }) =>
                track("first_report_created"),
              );
              window.localStorage.setItem("ar.firstReportTracked", "1");
            }
          } catch {
            /* ignore */
          }
          toast({
            title: t("company.detail.create_dialog.report_created_title"),
            description: t("company.detail.create_dialog.report_created_desc"),
          });
          queryClient.invalidateQueries({
            queryKey: getListReportsQueryKey(companyId),
          });
          setIsDialogOpen(false);
          setLocation(`/reports/${newReport.id}`);
        },
        onError: () => {
          toast({
            title: t("company.detail.create_dialog.create_error_title"),
            description: t("company.detail.create_dialog.create_error_desc"),
            variant: "destructive",
          });
        },
      },
    );
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
    return <div>{t("company.detail.not_found")}</div>;
  }

  const dateLocale = language === "sv" ? "sv-SE" : "en-GB";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="font-mono bg-muted/50">
              {company.orgNumber}
            </Badge>
            <Badge variant="secondary">{company.legalForm}</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            {company.name}
          </h1>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 h-11 px-6 shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> {t("company.detail.new_report")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("company.detail.create_dialog.title")}</DialogTitle>
              <DialogDescription>
                {t("company.detail.create_dialog.body_prefix")}
                {company.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>{t("company.detail.create_dialog.fiscal_year")}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={2999}
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  placeholder={String(currentYear - 1)}
                />
                {(() => {
                  const yr = parseInt(fiscalYear, 10);
                  const dates = !Number.isNaN(yr)
                    ? computeReportDates(yr)
                    : null;
                  return (
                    <p className="text-xs text-muted-foreground">
                      {t("company.detail.create_dialog.uses_defaults_prefix")}
                      <span className="font-medium">
                        {company.accountingFramework}
                      </span>
                      {dates ? (
                        <>
                          {t(
                            "company.detail.create_dialog.uses_defaults_period",
                          )}
                          <span className="font-mono">
                            {dates.start} → {dates.end}
                          </span>
                        </>
                      ) : null}
                    </p>
                  );
                })()}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                {t("company.detail.create_dialog.cancel")}
              </Button>
              <Button
                onClick={handleCreateReport}
                disabled={createReport.isPending}
              >
                {createReport.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("company.detail.create_dialog.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 shadow-sm h-fit">
          <CardHeader className="bg-muted/20 pb-4 border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" />{" "}
              {t("company.detail.info.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                {t("company.detail.info.address")}
              </div>
              <div className="mt-1">
                {company.address ? (
                  <>
                    <div>{company.address}</div>
                    <div>
                      {company.zipCode} {company.city}
                    </div>
                  </>
                ) : (
                  <span className="text-muted-foreground italic">
                    {t("company.detail.info.no_address")}
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">
                {t("company.detail.info.framework")}
              </div>
              <div className="mt-1">{company.accountingFramework}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">
                {t("company.detail.info.fiscal_default")}
              </div>
              <div className="mt-1 font-mono">
                {company.fiscalYearStart} – {company.fiscalYearEnd}
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t bg-muted/10 p-4">
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              asChild
            >
              <Link href={`/companies/${companyId}/edit`}>
                {t("company.detail.info.edit_link")}
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <div className="col-span-1 md:col-span-2 space-y-4">
          <h2 className="text-xl font-bold tracking-tight mb-4">
            {t("company.detail.reports.title")}
          </h2>

          {isReportsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : reports && reports.length > 0 ? (
            <div className="grid gap-4">
              {reports.map((report) => {
                const statusKey =
                  STATUS_KEY[report.status] ?? "report.status.draft";
                return (
                  <Card
                    key={report.id}
                    className="shadow-sm hover:border-primary/50 transition-colors group"
                  >
                    <Link href={`/reports/${report.id}`}>
                      <div className="p-5 flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                              report.status === "complete"
                                ? "bg-green-500/10 text-green-600"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            <FileText className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="font-semibold text-lg flex items-center gap-2">
                              {new Date(report.fiscalYearEnd).getFullYear()}
                              {t("company.detail.reports.year_suffix")}
                              <Badge
                                variant={
                                  report.status === "complete"
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  report.status === "complete"
                                    ? "bg-green-500 hover:bg-green-600"
                                    : ""
                                }
                              >
                                {t(statusKey)}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(
                                report.fiscalYearStart,
                              ).toLocaleDateString(dateLocale)}{" "}
                              —{" "}
                              {new Date(
                                report.fiscalYearEnd,
                              ).toLocaleDateString(dateLocale)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right hidden sm:block">
                            <div className="text-sm font-medium">
                              {report.completionPercent}%
                            </div>
                            <div className="w-24 h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{
                                  width: `${report.completionPercent}%`,
                                }}
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="group-hover:bg-primary/10 group-hover:text-primary"
                          >
                            <ArrowRight className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </Link>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed shadow-none bg-transparent">
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 opacity-50" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">
                  {t("company.detail.reports.empty.title")}
                </h3>
                <p className="mt-1 mb-6">
                  {t("company.detail.reports.empty.body")}
                </p>
                <Button
                  onClick={() => setIsDialogOpen(true)}
                  variant="outline"
                >
                  <Plus className="mr-2 h-4 w-4" />{" "}
                  {t("company.detail.reports.empty.cta")}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
