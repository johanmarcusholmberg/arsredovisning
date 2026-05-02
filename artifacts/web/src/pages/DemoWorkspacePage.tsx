import { useParams } from "wouter";
import { DemoDataBadge } from "@/components/badges/DemoDataBadge";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LayoutDashboard, FileUp, GitBranch, BarChart2,
  FileText, ShieldCheck, Users, Download, ChevronRight, BookOpen
} from "lucide-react";
import { OverviewSection } from "./demo/OverviewSection";
import { ImportSection } from "./demo/ImportSection";
import { MappingSection } from "./demo/MappingSection";
import { StatementsSection } from "./demo/StatementsSection";
import { NotesSection } from "./demo/NotesSection";
import { ValidationSection } from "./demo/ValidationSection";
import { ReviewSection } from "./demo/ReviewSection";
import { ExportSection } from "./demo/ExportSection";
import { ExamplePdfSection } from "./demo/ExamplePdfSection";
import { GuidancePanel } from "@/components/GuidancePanel";
import { MobileWorkspaceDrawer, DrawerNavItem } from "@/components/MobileWorkspaceDrawer";
import { Link } from "wouter";

type SectionKey = "overview" | "import" | "mapping" | "statements" | "notes" | "validation" | "review" | "export" | "example";

const sectionComponents: Record<SectionKey, React.ComponentType> = {
  overview: OverviewSection,
  import: ImportSection,
  mapping: MappingSection,
  statements: StatementsSection,
  notes: NotesSection,
  validation: ValidationSection,
  review: ReviewSection,
  export: ExportSection,
  example: ExamplePdfSection,
};

const sectionIcons: Record<SectionKey, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  import: FileUp,
  mapping: GitBranch,
  statements: BarChart2,
  notes: FileText,
  validation: ShieldCheck,
  review: Users,
  export: Download,
  example: BookOpen,
};

const sectionKeys: SectionKey[] = [
  "overview", "import", "mapping", "statements",
  "notes", "validation", "review", "export", "example",
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
  example: "demo.sidebar.example",
};

const sectionGuidanceKeys: Record<SectionKey, string> = {
  overview: "guidance.demo.overview",
  import: "guidance.demo.import",
  mapping: "guidance.demo.mapping",
  statements: "guidance.demo.statements",
  notes: "guidance.demo.notes",
  validation: "guidance.demo.validation",
  review: "guidance.demo.review",
  export: "guidance.demo.export",
  example: "guidance.demo.example",
};

export default function DemoWorkspacePage() {
  const { section } = useParams<{ section?: string }>();
  const { t } = useLanguage();
  const currentSection = (section as SectionKey) || "overview";

  const SectionComponent = sectionComponents[currentSection] || OverviewSection;

  const drawerItems: DrawerNavItem[] = sectionKeys.map((key) => ({
    key,
    label: t(sectionStringKeys[key] as Parameters<typeof t>[0]),
    Icon: sectionIcons[key],
    href: `/demo/${key}`,
    isActive: currentSection === key,
  }));

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Demo banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-4 sticky top-14 z-40">
        <div className="flex items-center gap-2.5">
          <DemoDataBadge />
          <span className="text-sm font-medium text-amber-800">
            {t("demo.banner")}
          </span>
        </div>
        <span className="text-xs text-amber-600 hidden sm:block">
          {t("demo.banner.readonly")}
        </span>
      </div>

      {/* Mobile drawer nav */}
      <MobileWorkspaceDrawer
        items={drawerItems}
        companyName="Nordic Design AB"
        companyMeta={t("demo.company.header")}
      />

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="w-56 shrink-0 border-r border-border bg-sidebar hidden md:flex flex-col">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider px-1">
              Nordic Design AB
            </p>
            <p className="text-xs text-sidebar-foreground/40 px-1 mt-0.5">{t("demo.company.header")}</p>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {sectionKeys.map((key) => {
              const Icon = sectionIcons[key];
              const isActive = currentSection === key;
              return (
                <Link
                  key={key}
                  href={`/demo/${key}`}
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

        {/* Main content */}
        <main className="flex-1 p-6 bg-background overflow-auto">
          <div className="max-w-4xl mx-auto">
            <SectionComponent />
          </div>
        </main>

        {/* Right Guidance Panel */}
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
