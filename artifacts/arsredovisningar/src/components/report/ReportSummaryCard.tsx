import {
  useGetFinancialStatements,
  getGetFinancialStatementsQueryKey,
  useListReportSignatories,
  getListReportSignatoriesQueryKey,
  type AnnualReport,
  type AnnualReportStatus,
  type FinancialStatementLine,
} from "@workspace/api-client-react";
import { formatSEK } from "@workspace/export-contract";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  PenLine,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import type { StringKey } from "@/i18n/strings";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReportSummaryMetric {
  label: string;
  current: number | null;
  previous: number | null;
}

export interface ReportSummarySignatory {
  name: string;
  role: string;
  signed: boolean;
}

export interface ReportSummaryCardProps {
  report: Pick<
    AnnualReport,
    "id" | "companyName" | "fiscalYearStart" | "fiscalYearEnd" | "status" | "accountingFramework"
  >;
  metrics?: ReportSummaryMetric[];
  metricsLoading?: boolean;
  signatories?: ReportSummarySignatory[];
  pageCount?: number | null;
  outputFormat?: string;
  variant?: "row" | "hero";
  trailing?: React.ReactNode;
  className?: string;
}

const STATUS_KEY: Record<AnnualReportStatus, StringKey> = {
  draft: "report.status.draft",
  in_progress: "report.status.in_progress",
  complete: "report.status.complete",
  exported: "report.status.exported",
};

// ─── Status pill ────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: AnnualReportStatus }) {
  const { t } = useLanguage();
  const ready = status === "complete" || status === "exported";

  if (ready) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 text-xs font-semibold">
        <ShieldCheck className="size-3.5" />
        {t("report.card.ready")}
      </span>
    );
  }

  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2.5 py-1 text-xs font-semibold">
        {t(STATUS_KEY[status])}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground border border-border px-2.5 py-1 text-xs font-semibold">
      {t(STATUS_KEY[status])}
    </span>
  );
}

// ─── Metric tile ────────────────────────────────────────────────────────────

function MetricTile({ metric }: { metric: ReportSummaryMetric }) {
  const { t } = useLanguage();
  const { label, current, previous } = metric;
  const hasCurrent = current !== null && current !== undefined;
  const hasPrev = previous !== null && previous !== undefined && previous !== 0;
  const delta = hasCurrent && hasPrev ? Math.round(((current! - previous!) / Math.abs(previous!)) * 100) : null;

  let deltaClass = "text-muted-foreground";
  let DeltaIcon: typeof TrendingUp | null = null;
  if (delta !== null) {
    if (delta > 0) {
      deltaClass = "text-emerald-600 dark:text-emerald-400";
      DeltaIcon = TrendingUp;
    } else if (delta < 0) {
      deltaClass = "text-red-600 dark:text-red-400";
      DeltaIcon = TrendingDown;
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background/60 p-3" data-testid={`metric-tile-${metric.label}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className="text-base sm:text-lg font-semibold text-foreground tabular-nums leading-tight mt-1">
        {hasCurrent ? formatSEK(current) : "—"}
      </p>
      <p className={cn("text-[11px] font-medium tabular-nums mt-0.5 inline-flex items-center gap-1", deltaClass)}>
        {DeltaIcon && <DeltaIcon className="size-3" />}
        {delta === null
          ? t("report.card.no_comparison")
          : `${delta > 0 ? "+" : ""}${delta}% ${t("report.card.vs_prev")}`}
      </p>
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────────

export function ReportSummaryCard({
  report,
  metrics,
  metricsLoading,
  signatories,
  pageCount,
  outputFormat,
  variant = "row",
  trailing,
  className,
}: ReportSummaryCardProps) {
  const { t } = useLanguage();
  const fiscalYearLabel = new Date(report.fiscalYearEnd).getFullYear();

  return (
    <div
      data-testid="report-summary-card"
      className={cn(
        "relative rounded-2xl border border-border bg-card shadow-sm overflow-hidden transition-colors",
        variant === "row" && "hover:border-primary/40",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-border bg-muted/30">
        <div className="size-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="size-3.5 text-primary" />
        </div>
        <p className="text-sm font-semibold text-foreground truncate">{report.companyName}</p>
        <span className="text-xs text-muted-foreground">·</span>
        <p className="text-sm font-mono text-muted-foreground tabular-nums">{fiscalYearLabel}</p>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-background border border-border rounded px-1.5 py-0.5">
          {report.accountingFramework}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Status row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <StatusPill status={report.status} />
          {(pageCount || outputFormat) && (
            <span className="text-[11px] font-mono text-muted-foreground">
              {pageCount ? `${pageCount} ${t("report.card.pages")}` : ""}
              {pageCount && outputFormat ? " · " : ""}
              {outputFormat ?? ""}
            </span>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2">
          {metricsLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] rounded-lg" />
              ))
            : (metrics ?? []).map((m) => <MetricTile key={m.label} metric={m} />)}
        </div>

        {/* Signatures */}
        {signatories && signatories.length > 0 && (
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <PenLine className="size-3.5 text-muted-foreground" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {t("report.card.signatures")}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {signatories.map((s, i) => (
                <div key={`${s.name}-${i}`} className="flex items-center gap-1.5 min-w-0">
                  {s.signed ? (
                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="size-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
                  )}
                  <span className="text-foreground truncate">{s.name}</span>
                  <span className="text-muted-foreground/80 truncate">· {s.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trailing */}
        {trailing && <div className="pt-1">{trailing}</div>}
      </div>
    </div>
  );
}

// ─── Connected variant: fetches metrics for a given report ──────────────────

const METRIC_KEYS = ["nettoomsattning", "rorelseresultat", "arets_resultat"] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

const METRIC_LABELS: Record<MetricKey, string> = {
  nettoomsattning: "Nettoomsättning",
  rorelseresultat: "Rörelseresultat",
  arets_resultat: "Årets resultat",
};

function parseAmount(s: string | null | undefined): number | null {
  if (s === null || s === undefined || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function findLine(lines: FinancialStatementLine[], lineKey: string): FinancialStatementLine | undefined {
  return lines.find((l) => l.lineKey === lineKey);
}

interface ConnectedReportSummaryCardProps
  extends Omit<ReportSummaryCardProps, "metrics" | "metricsLoading" | "signatories"> {
  reportId: string;
}

export function ConnectedReportSummaryCard({ reportId, ...rest }: ConnectedReportSummaryCardProps) {
  const { data, isLoading } = useGetFinancialStatements(
    reportId,
    {},
    {
      query: {
        enabled: !!reportId,
        queryKey: getGetFinancialStatementsQueryKey(reportId),
        staleTime: 30_000,
      },
    },
  );

  const { data: signaturesData } = useListReportSignatories(reportId, {
    query: {
      enabled: !!reportId,
      queryKey: getListReportSignatoriesQueryKey(reportId),
      staleTime: 30_000,
    },
  });

  const metrics: ReportSummaryMetric[] = METRIC_KEYS.map((key) => {
    const line = data ? findLine(data.incomeStatement, key) : undefined;
    return {
      label: METRIC_LABELS[key],
      current: line ? parseAmount(line.presentedCurrentYearAmount ?? line.currentYearAmount) : null,
      previous: line ? parseAmount(line.previousYearAmount) : null,
    };
  });

  const signatories: ReportSummarySignatory[] | undefined = signaturesData?.signatories.map(
    (s) => ({ name: s.name, role: s.role, signed: s.signed }),
  );

  return (
    <ReportSummaryCard
      {...rest}
      metrics={metrics}
      metricsLoading={isLoading}
      signatories={signatories}
    />
  );
}
