import { useRoute, Link, useLocation } from "wouter";
import { useGetReport, getGetReportQueryKey, useUpdateReport } from "@workspace/api-client-react";
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
  Calculator,
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
import { WorkflowProgress, type WorkflowStep, type StepStatus } from "@/components/WorkflowProgress";
import {
  getCashFlowAssessment,
  getCashFlowStatement,
  type CashFlowAssessmentResponse,
  type CashFlowStatementResponse,
} from "@workspace/api-client-react";

const SECTIONS = [
  {
    id: "import",
    title: "Importera bokföringsdata",
    icon: Upload,
    desc: "Ladda upp SIE-, Excel- eller CSV-fil och granska staging",
    href: "import",
  },
  {
    id: "mappning",
    title: "Kontomappning",
    icon: MapIcon,
    desc: "Granska BAS → K2/K3-mappning och justera vid behov",
    href: "mapping",
  },
  {
    id: "förvaltningsberättelse",
    title: "Förvaltningsberättelse",
    icon: AlignLeft,
    desc: "Förvaltningsberättelse och bolagsöversikt",
    href: null,
  },
  {
    id: "finansiella-rapporter",
    title: "Finansiella rapporter",
    icon: BarChart3,
    desc: "Resultaträkning, balansräkning och kassaflödesanalys",
    href: "statements",
  },
  {
    id: "noter",
    title: "Noter",
    icon: FileText,
    desc: "Redovisningsprinciper och tilläggsupplysningar",
    href: "notes",
  },
  {
    id: "omklassificeringar",
    title: "Omklassificeringar mellan noter",
    icon: Shuffle,
    desc: "Förslag och kvittningar mellan noter — granska och tillämpa",
    href: "reclassifications",
  },
  {
    id: "kassaflode",
    title: "Kassaflödesanalys",
    icon: TrendingUp,
    desc: "Bedöm laglig skyldighet och bygg kassaflödesanalysen (indirekt metod)",
    href: "cash-flow",
  },
  {
    id: "validering",
    title: "Validering",
    icon: ShieldAlert,
    desc: "Kör regler för att hitta blockerande problem och varningar",
    href: "validation",
  },
  {
    id: "granskning",
    title: "Granskning & samarbete",
    icon: ClipboardCheck,
    desc: "Granskningsstatus per avsnitt, kommentarer och samarbetspartners",
    href: "review",
  },
  {
    id: "aktivitet",
    title: "Aktivitet & revisionsspår",
    icon: History,
    desc: "Komplett händelselogg och ögonblicksbilder",
    href: "audit",
  },
  {
    id: "underskrifter",
    title: "Underskrifter",
    icon: PenTool,
    desc: "Styrelseledamöter och revisor",
    href: null,
  },
];

export function ReportWorkspace() {
  const [, params] = useRoute("/reports/:reportId");
  const [, navigate] = useLocation();
  const reportId = params?.reportId || "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: report, isLoading } = useGetReport(reportId, {
    query: {
      enabled: !!reportId,
      queryKey: getGetReportQueryKey(reportId),
    },
  });

  const updateReport = useUpdateReport();

  // ── Cash flow workflow step status ────────────────────────────────────────
  // Wires the "Kassaflödesanalys" workflow step to the real assessment +
  // statement state so the sidebar reflects whether it is mandatory, optional,
  // pending review, validated, or blocked.
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

  const handleStatusChange = (
    newStatus: "draft" | "in_progress" | "complete" | "exported",
  ) => {
    updateReport.mutate(
      { reportId, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast({
            title: "Status uppdaterad",
            description: `Rapportstatus ändrad till ${newStatus.replace("_", " ")}.`,
          });
          queryClient.invalidateQueries({ queryKey: getGetReportQueryKey(reportId) });
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
    return <div>Rapporten hittades inte.</div>;
  }

  const fiscalYear = new Date(report.fiscalYearEnd).getFullYear();

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
            Tillbaka till {report.companyName}
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
            {report.status.replace("_", " ").toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Title row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Årsredovisning {fiscalYear}
          </h1>
          <p className="text-muted-foreground mt-1">
            Räkenskapsår:{" "}
            {new Date(report.fiscalYearStart).toLocaleDateString("sv-SE")} —{" "}
            {new Date(report.fiscalYearEnd).toLocaleDateString("sv-SE")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {report.status !== "complete" && (
            <Button
              onClick={() => handleStatusChange("complete")}
              variant="outline"
              className="border-green-500/30 text-green-600 hover:bg-green-500/10"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Markera som klar
            </Button>
          )}
          <Button asChild>
            <Link href={`/reports/${report.id}/summary`}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Visa sammanfattning
            </Link>
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-2">
        {/* Sections list */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-xl font-bold tracking-tight mb-4">Avsnitt</h2>
          <div className="grid gap-3">
            {SECTIONS.map((section, idx) => (
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
                        {section.title}
                        {section.id === "finansiella-rapporter" && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-4 px-1.5 bg-primary/10 text-primary border-transparent"
                          >
                            Ny
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">{section.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {section.href ? (
                      <Badge
                        variant="secondary"
                        className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-transparent"
                      >
                        Granskas
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-muted/60 text-muted-foreground border-transparent"
                      >
                        Kommande
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
              <CardTitle className="text-lg">9-stegs arbetsflöde</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <WorkflowProgress steps={workflowSteps} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Snabbåtgärder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(`/reports/${reportId}/statements`)}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Finansiella rapporter
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(`/reports/${reportId}/preview`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                Förhandsvisa & exportera
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                <PenTool className="mr-2 h-4 w-4" />
                Skicka för signering
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

  // Requirement decision must be settled first.
  if (assessment.cashFlowRequirement === "unknown") {
    return {
      status: "needs-review" as StepStatus,
      badge: "Behöver bedömas",
      badgeTone: "warning",
    };
  }

  // Optional + voluntary disabled → not in export, not blocking.
  if (assessment.cashFlowRequirement === "optional" && !assessment.shouldIncludeInExport) {
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
        assessment.cashFlowRequirement === "mandatory" ? "Obligatorisk" : "Frivillig",
      badgeTone: assessment.cashFlowRequirement === "mandatory" ? "danger" : "info",
    };
  }

  switch (stmt.status) {
    case "validated":
      return { status: "completed" as StepStatus, badge: "Validerad", badgeTone: "success" };
    case "blocked":
      return { status: "blocked" as StepStatus, badge: "Blockerad", badgeTone: "danger" };
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
