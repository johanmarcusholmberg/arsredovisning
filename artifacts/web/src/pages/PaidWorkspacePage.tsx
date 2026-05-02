import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useLanguage } from "@/hooks/useLanguage";
import {
  LayoutDashboard, FileUp, GitBranch, BarChart2,
  FileText, ShieldCheck, Users, Download, ChevronRight,
  Lock, ArrowRight, AlertTriangle, Loader2,
} from "lucide-react";
import { OverviewSection } from "./demo/OverviewSection";
import { ImportSection } from "./workspace/ImportSection";
import { MappingSection } from "./workspace/MappingSection";
import { GuidancePanel } from "@/components/GuidancePanel";
import { MobileWorkspaceDrawer, DrawerNavItem } from "@/components/MobileWorkspaceDrawer";
import { Button } from "@/components/ui/button";

type SectionKey = "overview" | "import" | "mapping" | "statements" | "notes" | "validation" | "review" | "export";

interface ProjectInfo {
  id: string;
  companyName: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  accountingFramework: "K2" | "K3";
}

const sectionIcons: Record<SectionKey, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  import: FileUp,
  mapping: GitBranch,
  statements: BarChart2,
  notes: FileText,
  validation: ShieldCheck,
  review: Users,
  export: Download,
};

const sectionKeys: SectionKey[] = [
  "overview", "import", "mapping", "statements",
  "notes", "validation", "review", "export",
];

const sectionStringKeys: Record<SectionKey, string> = {
  overview: "demo.sidebar.overview",
  import: "demo.sidebar.import",
  mapping: "demo.sidebar.mapping",
  statements: "demo.sidebar.statements",
  notes: "demo.sidebar.notes",
  validation: "demo.sidebar.validation",
  review: "demo.sidebar.review",
  export: "demo.sidebar.export",
};

const sectionGuidanceKeys: Record<SectionKey, string> = {
  overview: "guidance.workspace.overview",
  import: "guidance.workspace.import",
  mapping: "guidance.workspace.mapping",
  statements: "guidance.workspace.statements",
  notes: "guidance.workspace.notes",
  validation: "guidance.workspace.validation",
  review: "guidance.workspace.review",
  export: "guidance.workspace.export",
};

export default function PaidWorkspacePage() {
  const { projectId, section } = useParams<{ projectId: string; section?: string }>();
  const { t } = useLanguage();
  const currentSection = (section as SectionKey) || "overview";

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<"not_found" | "network" | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setAccessError(null);

    fetch(`/api/projects/${projectId}`, { credentials: "include" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404 || res.status === 403) {
          setAccessError("not_found");
          setProject(null);
          return;
        }
        if (!res.ok) {
          setAccessError("network");
          setProject(null);
          return;
        }
        const data = await res.json();
        setProject({
          id: data.id,
          companyName: data.companyName ?? "—",
          fiscalYearStart: data.fiscalYearStart,
          fiscalYearEnd: data.fiscalYearEnd,
          accountingFramework: data.accountingFramework ?? "K3",
        });
      })
      .catch(() => {
        if (!cancelled) {
          setAccessError("network");
          setProject(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accessError || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-6">
        <div className="rounded-full bg-amber-100 p-4 mb-4">
          <AlertTriangle className="size-8 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">
          {accessError === "network"
            ? "Kunde inte ladda projektet"
            : "Projektet hittades inte"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-md text-center">
          {accessError === "network"
            ? "Ett nätverksfel uppstod. Försök igen om en stund."
            : "Projektet finns inte eller så har du inte behörighet att se det."}
        </p>
        <Link href="/dashboard">
          <Button>Tillbaka till översikten</Button>
        </Link>
      </div>
    );
  }

  const drawerItems: DrawerNavItem[] = sectionKeys.map((key) => ({
    key,
    label: t(sectionStringKeys[key] as Parameters<typeof t>[0]),
    Icon: sectionIcons[key],
    href: `/workspace/${projectId}/${key}`,
    isActive: currentSection === key,
  }));

  const fiscalRange = `${project.fiscalYearStart} – ${project.fiscalYearEnd}`;

  const renderSection = () => {
    switch (currentSection) {
      case "overview":
        return <OverviewSection />;
      case "import":
        return <ImportSection projectId={project.id} />;
      case "mapping":
        return <MappingSection projectId={project.id} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-xl bg-muted/10 h-[400px]">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Lock className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{t("workspace.section.placeholder.title")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t(sectionGuidanceKeys[currentSection] as Parameters<typeof t>[0])}
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Paid banner (mocking unpaid state for now) */}
      <div className="bg-muted border-b border-border px-4 py-2.5 flex items-center justify-between gap-4 sticky top-14 z-40">
        <div className="flex items-center gap-2.5">
          <Lock className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {t("workspace.payment.banner")}
          </span>
        </div>
        <Link href="/pricing">
          <Button variant="outline" size="sm" className="h-7 text-xs">
            {t("workspace.payment.cta")} <ArrowRight className="size-3 ml-1" />
          </Button>
        </Link>
      </div>

      <MobileWorkspaceDrawer
        items={drawerItems}
        companyName={project.companyName}
        companyMeta={fiscalRange}
        badge={project.accountingFramework}
      />

      <div className="flex flex-1">
        <aside className="w-56 shrink-0 border-r border-border bg-sidebar hidden md:flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold text-sidebar-foreground/80 uppercase tracking-wider truncate">
                {project.companyName}
              </p>
              <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium bg-muted/50 text-muted-foreground">
                {project.accountingFramework}
              </span>
            </div>
            <p className="text-xs text-sidebar-foreground/60 px-1 mt-1">{fiscalRange}</p>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {sectionKeys.map((key) => {
              const Icon = sectionIcons[key];
              const isActive = currentSection === key;
              return (
                <Link
                  key={key}
                  href={`/workspace/${projectId}/${key}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors group ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className={`size-4 shrink-0 ${isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70"}`} />
                  <span className="leading-tight">{t(sectionStringKeys[key] as Parameters<typeof t>[0])}</span>
                  {isActive && <ChevronRight className="size-3 ml-auto" />}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6 bg-background overflow-auto">
          <div className="max-w-4xl mx-auto">
            {renderSection()}
          </div>
        </main>

        <GuidancePanel>
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-foreground">
              {t(sectionStringKeys[currentSection] as Parameters<typeof t>[0])}
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(sectionGuidanceKeys[currentSection] as Parameters<typeof t>[0])}
            </p>
          </div>
        </GuidancePanel>
      </div>
    </div>
  );
}
