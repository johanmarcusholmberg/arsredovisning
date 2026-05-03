import { useRoute, Link, useLocation } from "wouter";
import {
  useGetReport,
  getGetReportQueryKey,
  useUpdateReport,
  type AnnualReportStatus,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  BarChart3,
  AlignLeft,
  PenTool,
  LayoutDashboard,
  TrendingUp,
  ShieldAlert,
  ClipboardCheck,
  History,
  Shuffle,
  Upload,
  Map as MapIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  WorkflowProgress,
  type WorkflowStep,
  type StepStatus,
} from "@/components/WorkflowProgress";
import {
  getCashFlowAssessment,
  getCashFlowStatement,
  type CashFlowAssessmentResponse,
  type CashFlowStatementResponse,
} from "@workspace/api-client-react";
import { useLanguage } from "@/hooks/useLanguage";
import type { StringKey } from "@/i18n/strings";

type Section = {
  id: string;
  titleKey: StringKey;
  descKey: StringKey;
  icon: typeof Upload;
  href: string | null;
};

const SECTIONS: Section[] = [
  {
    id: "import",
    titleKey: "workspace.section.import.title",
    descKey: "workspace.section.import.desc",
    icon: Upload,
    href: "import",
  },
  {
    id: "mappning",
    titleKey: "workspace.section.mapping.title",
    descKey: "workspace.section.mapping.desc",
    icon: MapIcon,
    href: "mapping",
  },
  {
    id: "förvaltningsberättelse",
    titleKey: "workspace.section.mgmt.title",
    descKey: "workspace.section.mgmt.desc",
    icon: AlignLeft,
    href: null,
  },
  {
    id: "finansiella-rapporter",
    titleKey: "workspace.section.statements.title",
    descKey: "workspace.section.statements.desc",
    icon: BarChart3,
    href: "statements",
  },
  {
    id: "noter",
    titleKey: "workspace.section.notes.title",
    descKey: "workspace.section.notes.desc",
    icon: FileText,
    href: "notes",
  },
  {
    id: "omklassificeringar",
    titleKey: "workspace.section.reclass.title",
    descKey: "workspace.section.reclass.desc",
    icon: Shuffle,
    href: "reclassifications",
  },
  {
    id: "kassaflode",
    titleKey: "workspace.section.cashflow.title",
    descKey: "workspace.section.cashflow.desc",
    icon: TrendingUp,
    href: "cash-flow",
  },
  {
    id: "validering",
    titleKey: "workspace.section.validation.title",
    descKey: "workspace.section.validation.desc",
    icon: ShieldAlert,
    href: "validation",
  },
  {
    id: "granskning",
    titleKey: "workspace.section.review.title",
    descKey: "workspace.section.review.desc",
    icon: ClipboardCheck,
    href: "review",
  },
  {
    id: "aktivitet",
    titleKey: "workspace.section.audit.title",
    descKey: "workspace.section.audit.desc",
    icon: History,
    href: "audit",
  },
  {
    id: "underskrifter",
    titleKey: "workspace.section.signatures.title",
    descKey: "workspace.section.signatures.desc",
    icon: PenTool,
    href: null,
  },
];

const STATUS_KEY: Record<AnnualReportStatus, StringKey> = {
  draft: "report.status.draft",
  in_progress: "report.status.in_progress",
  complete: "report.status.complete",
  exported: "report.status.exported",
};

export function ReportWorkspace() {
  const [, params] = useRoute("/reports/:reportId");
  const [, navigate] = useLocation();
  const reportId = params?.reportId || "";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();

  const { data: report, isLoading } = useGetReport(reportId, {
    query: {
      enabled: !!reportId,
      queryKey: getGetReportQueryKey(reportId),
    },
  });

  const updateReport = useUpdateReport();

  // ── Cash flow workflow step status ────────────────────────────────────────
  const { data: cfAssessment } = useQuery<CashFlowAssessmentResponse>({
    queryKey: ["cf-assessment", reportId],
    enabled: !!reportId,
    queryFn: () => getCashFlowAssessment(reportId),
  });
  const { data: cfStatement } = useQuery<CashFlowStatementResponse>({
    queryKey: ["cf-statement", reportId],
    enabled: !!reportId,
    queryFn: () => getCashFlowStatement(reportId),
  });

  const cashFlowStep = deriveCashFlowStep(cfAssessment, cfStatement);
  const workflowSteps: WorkflowStep[] = DEFAULT_WORKFLOW_STEPS.map((s) =>
    s.id === "cash-flow" ? { ...s, ...cashFlowStep } : s,
  );

  const handleStatusChange = (newStatus: AnnualReportStatus) => {
    updateReport.mutate(
      { reportId, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast({
            title: t("workspace.status_changed.title"),
            description: `${t("workspace.status_changed.desc_prefix")}${t(STATUS_KEY[newStatus]).toLowerCase()}.`,
          });
          queryClient.invalidateQueries({
            queryKey: getGetReportQueryKey(reportId),
          });
        },
      },
    );
  };

  const handleSectionClick = (href: string | null) => {
    if (href) navigate(`/reports/${reportId}/${href}`);
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
    return <div>{t("workspace.not_found")}</div>;
  }

  const fiscalYear = new Date(report.fiscalYearEnd).getFullYear();
  const dateLocale = language === "sv" ? "sv-SE" : "en-GB";

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href={`/companies/${report.companyId}`}
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("workspace.back_to")}
            {report.companyName}
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono">
            {report.accountingFramework}
          </Badge>
          <Badge
            variant={report.status === "complete" ? "default" : "secondary"}
            className={report.status === "complete" ? "bg-green-500" : ""}
          >
            {t(STATUS_KEY[report.status as AnnualReportStatus] ?? "report.status.draft")}
          </Badge>
        </div>
      </div>

      {/* Title row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("workspace.title_prefix")}
            {fiscalYear}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("workspace.fiscal_year")}
            {new Date(report.fiscalYearStart).toLocaleDateString(dateLocale)} —{" "}
            {new Date(report.fiscalYearEnd).toLocaleDateString(dateLocale)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {report.status !== "complete" ? (
            <Button
              onClick={() => handleStatusChange("complete")}
              variant="outline"
              className="border-green-500/30 text-green-600 hover:bg-green-500/10"
              disabled={updateReport.isPending}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {t("workspace.mark_complete")}
            </Button>
          ) : (
            <Button
              onClick={() => handleStatusChange("in_progress")}
              variant="outline"
              className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
              disabled={updateReport.isPending}
              title={t("workspace.unmark_complete_title")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("workspace.unmark_complete")}
            </Button>
          )}
          <Button asChild>
            <Link href={`/reports/${report.id}/summary`}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              {t("workspace.view_summary")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-2">
        {/* Sections list */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-xl font-bold tracking-tight mb-4">
            {t("workspace.sections")}
          </h2>
          <div className="grid gap-3">
            {SECTIONS.map((section) => (
              <Card
                key={section.id}
                className={`shadow-sm transition-colors ${
                  section.href
                    ? "hover:border-primary/50 cursor-pointer group"
                    : "opacity-60 cursor-not-allowed"
                }`}
                onClick={() => handleSectionClick(section.href)}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center transition-colors ${
                        section.href
                          ? "group-hover:bg-primary/10 group-hover:text-primary"
                          : ""
                      }`}
                    >
                      <section.icon
                        className={`h-5 w-5 text-muted-foreground transition-colors ${
                          section.href ? "group-hover:text-primary" : ""
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        {t(section.titleKey)}
                        {section.id === "finansiella-rapporter" && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-4 px-1.5 bg-primary/10 text-primary border-transparent"
                          >
                            {t("workspace.section.new")}
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t(section.descKey)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {section.href ? (
                      <Badge
                        variant="secondary"
                        className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-transparent"
                      >
                        {t("workspace.section.in_review")}
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-muted/60 text-muted-foreground border-transparent"
                      >
                        {t("workspace.section.upcoming")}
                      </Badge>
                    )}
                    {section.href && (
                      <ChevronRight className="h-5 w-5 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all" />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg">
                {t("workspace.workflow.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <WorkflowProgress steps={workflowSteps} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {t("workspace.quick_actions")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(`/reports/${reportId}/statements`)}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                {t("workspace.quick.statements")}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(`/reports/${reportId}/preview`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                {t("workspace.quick.preview")}
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                <PenTool className="mr-2 h-4 w-4" />
                {t("workspace.quick.sign")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Workflow helpers ───────────────────────────────────────────────────────

const DEFAULT_WORKFLOW_STEPS: WorkflowStep[] = [
  { id: "import", label: "Importera bokföring", status: "not-started" },
  { id: "mapping", label: "Granska kontomappning", status: "not-started" },
  { id: "structure", label: "Generera rapportstruktur", status: "not-started" },
  { id: "statements", label: "Granska finansiella rapporter", status: "not-started" },
  { id: "notes", label: "Granska noter", status: "not-started" },
  { id: "reclassification", label: "Omklassificering & nettning", status: "not-started" },
  { id: "cash-flow", label: "Kassaflödesanalys", status: "not-started" },
  { id: "validate", label: "Validera", status: "not-started" },
  { id: "collaborate", label: "Samarbeta & granska", status: "not-started" },
  { id: "preview", label: "Förhandsvisa & exportera", status: "not-started" },
  { id: "export", label: "Slutgiltig export", status: "not-started" },
];

/**
 * Map cash-flow assessment + statement state to the workflow step
 * status + an inline badge using the canonical Swedish labels:
 *   Obligatorisk · Frivillig · Behöver bedömas · Behöver granskas
 *   · Validerad · Blockerad
 */
function deriveCashFlowStep(
  assessment: CashFlowAssessmentResponse | undefined,
  cf: CashFlowStatementResponse | undefined,
): Partial<WorkflowStep> {
  if (!assessment) return {};

  if (assessment.cashFlowRequirement === "unknown") {
    return {
      status: "needs-review" as StepStatus,
      badge: "Behöver bedömas",
      badgeTone: "warning",
    };
  }

  if (
    assessment.cashFlowRequirement === "optional" &&
    !assessment.shouldIncludeInExport
  ) {
    return {
      status: "not-started" as StepStatus,
      badge: "Frivillig",
      badgeTone: "default",
    };
  }

  const stmt = cf?.statement ?? null;
  if (!stmt) {
    return {
      status: "needs-review" as StepStatus,
      badge:
        assessment.cashFlowRequirement === "mandatory"
          ? "Obligatorisk"
          : "Frivillig",
      badgeTone:
        assessment.cashFlowRequirement === "mandatory" ? "danger" : "info",
    };
  }

  switch (stmt.status) {
    case "validated":
      return {
        status: "completed" as StepStatus,
        badge: "Validerad",
        badgeTone: "success",
      };
    case "blocked":
      return {
        status: "blocked" as StepStatus,
        badge: "Blockerad",
        badgeTone: "danger",
      };
    case "needs_review":
      return {
        status: "needs-review" as StepStatus,
        badge: "Behöver granskas",
        badgeTone: "warning",
      };
    case "draft":
    default:
      return {
        status: "current" as StepStatus,
        badge:
          assessment.cashFlowRequirement === "mandatory"
            ? "Obligatorisk"
            : "Frivillig",
        badgeTone:
          assessment.cashFlowRequirement === "mandatory" ? "danger" : "info",
      };
  }
}
