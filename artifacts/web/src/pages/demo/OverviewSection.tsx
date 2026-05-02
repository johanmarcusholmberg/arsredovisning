import { demoData } from "@/data/demoData";
import { StatusBadge } from "@/components/badges/StatusBadge";
import { useLanguage } from "@/hooks/useLanguage";
import { Building2, Calendar, FileCheck, ArrowRight, BookOpen, Sparkles, FileUp } from "lucide-react";
import { WorkflowProgress, WorkflowStep } from "@/components/WorkflowProgress";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

type StatusType = "draft" | "done" | "warning" | "error" | "in_progress";

const sectionStatusKeys: { key: keyof typeof demoData.overviewStatus; labelKey: string }[] = [
  { key: "import", labelKey: "demo.sidebar.import" },
  { key: "mapping", labelKey: "demo.sidebar.mapping" },
  { key: "statements", labelKey: "demo.sidebar.statements" },
  { key: "notes", labelKey: "demo.sidebar.notes" },
  { key: "validation", labelKey: "demo.sidebar.validation" },
];

const statusLabelKey: Record<StatusType, string> = {
  done: "demo.status.label.done",
  in_progress: "demo.status.label.in_progress",
  draft: "demo.status.label.draft",
  warning: "demo.status.label.warning",
  error: "demo.status.label.error",
};

function getValidationStatus(v: { warnings: number; errors: number }): StatusType {
  if (v.errors > 0) return "error";
  if (v.warnings > 0) return "warning";
  return "done";
}

export function OverviewSection() {
  const { t } = useLanguage();
  const { company, overviewStatus } = demoData;

  const statusMap: Record<string, StatusType> = {
    import: overviewStatus.import as StatusType,
    mapping: overviewStatus.mapping as StatusType,
    statements: overviewStatus.statements as StatusType,
    notes: overviewStatus.notes as StatusType,
    validation: getValidationStatus(overviewStatus.validation),
  };

  const workflowSteps: WorkflowStep[] = [
    { id: "1", label: t("landing.steps.1"), state: "completed" },
    { id: "2", label: t("landing.steps.2"), state: "completed" },
    { id: "3", label: t("landing.steps.3"), state: "completed" },
    { id: "4", label: t("landing.steps.4"), state: "current" },
    { id: "5", label: t("landing.steps.5"), state: "not-started" },
    { id: "6", label: t("landing.steps.6"), state: "not-started" },
    { id: "7", label: t("landing.steps.7"), state: "not-started" },
    { id: "8", label: t("landing.steps.8"), state: "not-started" },
    { id: "9", label: t("landing.steps.9"), state: "not-started" },
  ];

  return (
    <div className="space-y-6">
      {/* Friendly intro hero */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground">
              {t("demo.intro.title")}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1.5 max-w-2xl">
              {t("demo.intro.body")}
            </p>
            <Link href="/demo/import" className="inline-block mt-4">
              <Button size="sm" variant="outline" className="gap-2">
                <FileUp className="size-3.5" />
                {t("demo.intro.cta")}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          {t("demo.overview.company.title")}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t("demo.overview.company.name")}</p>
            <p className="font-medium text-foreground mt-0.5">{company.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("demo.overview.company.org")}</p>
            <p className="font-medium text-foreground mt-0.5">{company.orgNr}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("demo.overview.company.framework")}</p>
            <p className="font-medium text-foreground mt-0.5">{company.framework}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3" /> {t("demo.overview.company.fiscal")}
            </p>
            <p className="font-medium text-foreground mt-0.5">{company.fiscalYear}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileCheck className="size-4 text-muted-foreground" />
          {t("demo.overview.status.title")}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sectionStatusKeys.map(({ key, labelKey }) => {
            const status = statusMap[key];
            return (
              <div
                key={key}
                className="rounded-lg border border-border bg-card px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{t(labelKey as Parameters<typeof t>[0])}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(statusLabelKey[status] as Parameters<typeof t>[0])}
                  </p>
                </div>
                <StatusBadge status={status} />
              </div>
            );
          })}
        </div>
      </div>

      {overviewStatus.validation.errors > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">
            {overviewStatus.validation.errors} {t("demo.overview.validation.error")}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5 mt-6">
        <h2 className="text-base font-semibold text-foreground mb-6">Process</h2>
        <WorkflowProgress steps={workflowSteps} />
      </div>

      {/* Example PDF callout */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 shrink-0">
              <BookOpen className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {t("demo.export.example.title")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("demo.export.example.description")}
              </p>
            </div>
          </div>
          <Link href="/demo/example" className="shrink-0">
            <Button className="w-full sm:w-auto gap-2">
              {t("demo.export.example.cta")}
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
