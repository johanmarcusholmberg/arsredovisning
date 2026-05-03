import { Link } from "wouter";
import {
  useListCompanies,
  getListCompaniesQueryKey,
  useListReports,
  getListReportsQueryKey,
  type AnnualReport,
  type AnnualReportStatus,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building, Plus, ChevronRight } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import type { StringKey } from "@/i18n/strings";

const STATUS_KEY: Record<AnnualReportStatus, StringKey> = {
  draft: "report.status.draft",
  in_progress: "report.status.in_progress",
  complete: "report.status.complete",
  exported: "report.status.exported",
};

const STATUS_CLS: Record<AnnualReportStatus, string> = {
  draft: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  in_progress: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  complete: "bg-green-500/10 text-green-700 border-green-500/30",
  exported: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
};

function pickLatestReport(
  reports: AnnualReport[] | undefined,
): AnnualReport | null {
  if (!reports || reports.length === 0) return null;
  return [...reports].sort((a, b) =>
    b.fiscalYearEnd.localeCompare(a.fiscalYearEnd),
  )[0];
}

function CompanyReportCell({ companyId }: { companyId: string }) {
  const { t } = useLanguage();
  const { data: reports, isLoading } = useListReports(companyId, {
    query: { queryKey: getListReportsQueryKey(companyId) },
  });

  if (isLoading) {
    return <Skeleton className="h-5 w-24" />;
  }

  const latest = pickLatestReport(reports);
  if (!latest) {
    return (
      <span className="text-xs text-muted-foreground/60">
        {t("companies.no_report")}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <Badge
        variant="outline"
        className={`${STATUS_CLS[latest.status]} w-fit text-[11px]`}
      >
        {t(STATUS_KEY[latest.status])}
      </Badge>
      <div className="flex items-center gap-2">
        <div className="h-1 w-20 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary"
            style={{ width: `${latest.completionPercent}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {latest.completionPercent}%
        </span>
      </div>
    </div>
  );
}

function CompanyReportCountCell({ companyId }: { companyId: string }) {
  const { data: reports, isLoading } = useListReports(companyId, {
    query: { queryKey: getListReportsQueryKey(companyId) },
  });
  if (isLoading) return <Skeleton className="h-4 w-10" />;
  const count = reports?.length ?? 0;
  return (
    <span className="text-xs font-mono text-muted-foreground tabular-nums">
      {count}
    </span>
  );
}

function CompanyLatestYearCell({ companyId }: { companyId: string }) {
  const { data: reports, isLoading } = useListReports(companyId, {
    query: { queryKey: getListReportsQueryKey(companyId) },
  });
  if (isLoading) return <Skeleton className="h-4 w-16" />;
  const latest = pickLatestReport(reports);
  if (!latest) return <span className="text-muted-foreground/50">—</span>;
  return (
    <span className="text-xs font-mono text-muted-foreground tabular-nums">
      {new Date(latest.fiscalYearEnd).getFullYear()}
    </span>
  );
}

export function Companies() {
  const { t } = useLanguage();
  const {
    data: companies,
    isLoading,
    isError,
  } = useListCompanies({
    query: { queryKey: getListCompaniesQueryKey() },
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("companies.title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            {t("companies.subtitle")}
          </p>
        </div>
        <Button asChild className="shrink-0 h-11 px-6 shadow-sm">
          <Link href="/companies/new">
            <Plus className="mr-2 h-4 w-4" /> {t("companies.new")}
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Card className="shadow-sm overflow-hidden">
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      ) : isError ? (
        <div className="bg-destructive/10 text-destructive p-6 rounded-lg border border-destructive/20 text-center">
          <h3 className="font-bold text-lg mb-2">
            {t("companies.error.title")}
          </h3>
          <p>{t("companies.error.body")}</p>
        </div>
      ) : !companies || companies.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Building className="h-8 w-8 opacity-50" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">
              {t("companies.empty.title")}
            </h3>
            <p className="mt-1 mb-6">{t("companies.empty.body")}</p>
            <Button asChild>
              <Link href="/companies/new">
                <Plus className="mr-2 h-4 w-4" /> {t("companies.empty.cta")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[24%]">
                  {t("companies.col.name")}
                </TableHead>
                <TableHead className="w-[14%]">
                  {t("companies.col.org_number")}
                </TableHead>
                <TableHead className="w-[8%]">
                  {t("companies.col.form")}
                </TableHead>
                <TableHead className="w-[8%]">
                  {t("companies.col.framework")}
                </TableHead>
                <TableHead className="w-[16%]">
                  {t("companies.col.latest_report")}
                </TableHead>
                <TableHead className="w-[7%] text-right">
                  {t("companies.col.year")}
                </TableHead>
                <TableHead className="w-[7%] text-right">
                  {t("companies.col.count")}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("companies.col.location")}
                </TableHead>
                <TableHead
                  className="w-[40px]"
                  aria-label={t("companies.col.open_aria")}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => {
                const location = [company.zipCode, company.city]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <TableRow
                    key={company.id}
                    className="group cursor-pointer"
                    onClick={(e) => {
                      // Let the inner <Link> handle clicks; this is a
                      // backup so the whole row is clickable for users who
                      // miss the title link.
                      const target = e.target as HTMLElement;
                      if (target.closest("a")) return;
                      const link =
                        e.currentTarget.querySelector<HTMLAnchorElement>(
                          "a[data-row-link]",
                        );
                      link?.click();
                    }}
                  >
                    <TableCell className="font-medium">
                      <Link
                        href={`/companies/${company.id}`}
                        data-row-link
                        className="hover:underline focus:outline-none focus-visible:underline"
                      >
                        {company.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {company.orgNumber}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {company.legalForm}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {company.accountingFramework}
                    </TableCell>
                    <TableCell>
                      <CompanyReportCell companyId={company.id} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CompanyLatestYearCell companyId={company.id} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CompanyReportCountCell companyId={company.id} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground truncate max-w-[200px]">
                      {location || (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary transition-colors inline" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
