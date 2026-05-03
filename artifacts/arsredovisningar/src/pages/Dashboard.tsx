import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useListCompanies,
  getListCompaniesQueryKey,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Building,
  FileText,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  Upload,
  ListChecks,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import type { StringKey } from "@/i18n/strings";
import { useEffect } from "react";
import { useEntitlement } from "@/hooks/useEntitlement";
import {
  Sparkles,
  Lock,
  ShieldCheck,
  PlayCircle,
  KeyRound,
} from "lucide-react";

const STATUS_KEY: Record<string, StringKey> = {
  draft: "report.status.draft",
  in_progress: "report.status.in_progress",
  complete: "report.status.complete",
  exported: "report.status.exported",
};

/**
 * Renders the primary "New Company" CTA. For paid users this is a normal
 * link to the create form. For free users we still render it (so the page
 * looks the same) but the click takes them to /upgrade and the icon
 * switches to a lock — a visible signal that this is a gated action.
 */
function NewCompanyCTA() {
  const { t } = useLanguage();
  const { isLoading, isPaid } = useEntitlement();
  if (isLoading) return null;
  const target = isPaid ? "/companies/new" : "/upgrade";
  return (
    <Button asChild className="shrink-0 h-11 px-6 shadow-sm">
      <Link href={target}>
        {isPaid ? (
          <Plus className="mr-2 h-4 w-4" />
        ) : (
          <Lock className="mr-2 h-4 w-4" />
        )}
        {t("dashboard.new_company")}
      </Link>
    </Button>
  );
}

/**
 * Account status card shown to free (demo) users in place of the old
 * credit-based banner. Communicates that the account is in demo/unpaid
 * mode and offers two clear actions: explore demo, or unlock a real
 * project. Hidden for paid users — they get <ActiveLicensesCard /> instead.
 */
function DemoAccountCard() {
  const { t } = useLanguage();
  const { isLoading, isFree } = useEntitlement();
  if (isLoading || !isFree) return null;
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary p-2 rounded-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <Badge variant="secondary" className="mb-1">
                {t("account.status.demo.badge")}
              </Badge>
              <p className="font-semibold text-base">
                {t("account.status.demo.title")}
              </p>
              <p className="text-sm text-muted-foreground max-w-2xl">
                {t("account.status.demo.body")}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:flex-col md:items-end shrink-0">
            <Button asChild variant="outline">
              <a href="/demo">
                <PlayCircle className="h-4 w-4 mr-2" />
                {t("account.status.demo.cta_demo")}
              </a>
            </Button>
            <Button asChild>
              <Link href="/upgrade">
                <KeyRound className="h-4 w-4 mr-2" />
                {t("account.status.demo.cta_unlock")}
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Lists the gated capabilities a user gets after unlocking a project.
 * Shown only to free users so they understand what payment unlocks.
 */
function LockedFeaturesCard() {
  const { t } = useLanguage();
  const { isLoading, isFree } = useEntitlement();
  if (isLoading || !isFree) return null;
  const items: StringKey[] = [
    "account.status.locked.import",
    "account.status.locked.create",
    "account.status.locked.mapping",
    "account.status.locked.statements",
    "account.status.locked.notes",
    "account.status.locked.validate",
    "account.status.locked.export",
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          {t("account.status.locked.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {items.map((key) => (
            <li key={key} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Active license summary for paid users. Replaces the credit-balance
 * messaging — instead we surface that the user has one or more active
 * annual-report projects unlocked (one per company + fiscal year).
 */
function ActiveLicensesCard() {
  const { t } = useLanguage();
  const { isLoading, isPaid, isAdmin, paidProjectIds } = useEntitlement();
  if (isLoading || !isPaid) return null;
  const count = paidProjectIds.length;
  const countLabel = isAdmin
    ? t("account.status.licenses.admin")
    : count === 1
      ? t("account.status.licenses.count_one")
      : count === 0
        ? t("account.status.licenses.empty")
        : t("account.status.licenses.count_many").replace("{n}", String(count));
  return (
    <Card className="border-green-200 bg-green-50/40">
      <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-5">
        <div className="flex items-start gap-3">
          <div className="bg-green-500/10 text-green-700 p-2 rounded-md">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-base">
              {t("account.status.licenses.title")}
            </p>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {countLabel} · {t("account.status.licenses.subtitle")}
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/companies">
            {t("account.status.licenses.cta")}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { t } = useLanguage();
  const { toast } = useToast();

  // One-time post-signup nudge for users who came from the demo (P2-2).
  // The flag is set in Register.tsx when the URL has ?from=demo and
  // consumed here on first Dashboard mount, then cleared so we never
  // re-prompt. We don't auto-create a sample company — the toast simply
  // points users at the existing CompanyNew flow.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let source: string | null = null;
    try {
      source = window.localStorage.getItem("ar.signupSource");
    } catch {
      /* ignore */
    }
    if (source !== "demo") return;
    try {
      window.localStorage.removeItem("ar.signupSource");
    } catch {
      /* ignore */
    }
    toast({
      title: t("register.demo_prompt.title"),
      description: t("register.demo_prompt.body"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    data: summary,
    isLoading,
    isError,
  } = useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey(),
    },
  });

  // We pull the company list separately so the empty-state hero can decide
  // whether to render even when the summary endpoint says "0 reports" but
  // the user might already have set up companies. Cheap because react-query
  // dedupes with the Companies page.
  const { data: companies } = useListCompanies({
    query: { queryKey: getListCompaniesQueryKey() },
  });

  const showWelcome =
    !isLoading &&
    !isError &&
    summary &&
    summary.totalCompanies === 0 &&
    (companies?.length ?? 0) === 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("dashboard.title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            {t("dashboard.subtitle")}
          </p>
        </div>
        {!showWelcome && <NewCompanyCTA />}
      </div>

      <DemoAccountCard />
      <ActiveLicensesCard />
      <LockedFeaturesCard />

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
          <h3 className="font-bold text-lg mb-2">
            {t("dashboard.error.title")}
          </h3>
          <p>{t("dashboard.error.body")}</p>
        </div>
      ) : showWelcome ? (
        <WelcomeHero />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title={t("dashboard.kpi.companies")}
              sub={t("dashboard.kpi.companies.sub")}
              value={summary.totalCompanies}
              icon={<Building className="h-4 w-4 text-primary" />}
            />
            <KpiCard
              title={t("dashboard.kpi.reports")}
              sub={t("dashboard.kpi.reports.sub")}
              value={summary.totalReports}
              icon={<FileText className="h-4 w-4 text-blue-500" />}
            />
            <KpiCard
              title={t("dashboard.kpi.in_progress")}
              sub={t("dashboard.kpi.in_progress.sub")}
              value={summary.reportsInProgress}
              icon={<Clock className="h-4 w-4 text-amber-500" />}
            />
            <KpiCard
              title={t("dashboard.kpi.complete")}
              sub={t("dashboard.kpi.complete.sub")}
              value={summary.reportsComplete}
              icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
            />
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-bold tracking-tight mb-4">
              {t("dashboard.recent.title")}
            </h2>
            <Card className="shadow-sm overflow-hidden">
              {summary.recentReports && summary.recentReports.length > 0 ? (
                <div className="divide-y divide-border">
                  {summary.recentReports.map((report) => {
                    const statusKey =
                      STATUS_KEY[report.status] ?? "report.status.draft";
                    return (
                      <Link
                        key={report.id}
                        href={`/reports/${report.id}`}
                        className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group cursor-pointer block"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold">
                              {report.companyName}
                            </p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {new Date(
                                report.fiscalYearStart,
                              ).toLocaleDateString("sv-SE")}{" "}
                              –{" "}
                              {new Date(
                                report.fiscalYearEnd,
                              ).toLocaleDateString("sv-SE")}{" "}
                              • {report.accountingFramework}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <div className="text-sm font-medium">
                              {report.completionPercent}
                              {t("dashboard.recent.percent_complete")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {report.sectionsCompleted}/
                              {report.sectionsTotal}{" "}
                              {t("dashboard.recent.sections")}
                            </div>
                          </div>
                          <Badge
                            variant={
                              report.status === "complete" ||
                              report.status === "exported"
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
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 opacity-50" />
                  </div>
                  <h3 className="font-semibold text-lg text-foreground">
                    {t("dashboard.empty.title")}
                  </h3>
                  <p className="mt-1 mb-6">{t("dashboard.empty.body")}</p>
                  <Button asChild variant="outline">
                    <Link href="/companies/new">
                      {t("dashboard.empty.cta")}
                    </Link>
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

function KpiCard({
  title,
  sub,
  value,
  icon,
}: {
  title: string;
  sub: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm hover:shadow transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold font-mono tracking-tight">
          {value}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

/**
 * First-run hero. Shown when the workspace has zero companies AND zero
 * reports — i.e. a fresh account that hasn't done anything yet. Replaces
 * the bare "0 / 0 / 0 / 0" KPI grid which was a confusing first impression.
 */
function WelcomeHero() {
  const { t } = useLanguage();
  return (
    <Card className="shadow-md border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card overflow-hidden">
      <CardContent className="p-8 sm:p-10">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {t("dashboard.welcome.title")}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {t("dashboard.welcome.title")}
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
              {t("dashboard.welcome.body")}
            </p>
            <Button asChild size="lg" className="h-12 px-6 shadow">
              <Link href="/companies/new">
                <Plus className="mr-2 h-4 w-4" />
                {t("dashboard.welcome.cta")}
              </Link>
            </Button>
          </div>
          <ul className="grid gap-3 sm:gap-4 w-full lg:w-72 shrink-0">
            <BenefitRow
              icon={<Upload className="h-4 w-4" />}
              text={t("dashboard.welcome.benefits.import")}
            />
            <BenefitRow
              icon={<ListChecks className="h-4 w-4" />}
              text={t("dashboard.welcome.benefits.mapping")}
            />
            <BenefitRow
              icon={<FileDown className="h-4 w-4" />}
              text={t("dashboard.welcome.benefits.export")}
            />
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function BenefitRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5">
      <span className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="text-sm">{text}</span>
    </li>
  );
}
