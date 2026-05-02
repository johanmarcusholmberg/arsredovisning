import { useParams, Link, useLocation } from "wouter";
import { DemoDataBadge } from "@/components/badges/DemoDataBadge";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LayoutDashboard, FileUp, GitBranch, BarChart2,
  FileText, ShieldCheck, Users, Download, ChevronRight
} from "lucide-react";
import { OverviewSection } from "./demo/OverviewSection";
import { ImportSection } from "./demo/ImportSection";
import { MappingSection } from "./demo/MappingSection";
import { StatementsSection } from "./demo/StatementsSection";
import { NotesSection } from "./demo/NotesSection";
import { ValidationSection } from "./demo/ValidationSection";
import { ReviewSection } from "./demo/ReviewSection";
import { ExportSection } from "./demo/ExportSection";

type SectionKey = "overview" | "import" | "mapping" | "statements" | "notes" | "validation" | "review" | "export";

const sectionComponents: Record<SectionKey, React.ComponentType> = {
  overview: OverviewSection,
  import: ImportSection,
  mapping: MappingSection,
  statements: StatementsSection,
  notes: NotesSection,
  validation: ValidationSection,
  review: ReviewSection,
  export: ExportSection,
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
};

const sectionKeys: SectionKey[] = [
  "overview", "import", "mapping", "statements",
  "notes", "validation", "review", "export",
];

const sectionStringKeys = {
  overview: "demo.sidebar.overview",
  import: "demo.sidebar.import",
  mapping: "demo.sidebar.mapping",
  statements: "demo.sidebar.statements",
  notes: "demo.sidebar.notes",
  validation: "demo.sidebar.validation",
  review: "demo.sidebar.review",
  export: "demo.sidebar.export",
} as const;

export default function DemoWorkspacePage() {
  const { section } = useParams<{ section?: string }>();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const currentSection = (section as SectionKey) || "overview";

  const SectionComponent = sectionComponents[currentSection] || OverviewSection;

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

      <div className="flex flex-1">
        {/* Sidebar */}
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
                  <span className="leading-tight">{t(sectionStringKeys[key])}</span>
                  {isActive && <ChevronRight className="size-3 ml-auto" />}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile section picker — uses router navigation, respects base path */}
        <div className="md:hidden w-full border-b border-border bg-background px-4 py-2">
          <label className="sr-only">{t("demo.section.selector.label")}</label>
          <select
            value={currentSection}
            onChange={(e) => setLocation(`/demo/${e.target.value}`)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {sectionKeys.map((key) => (
              <option key={key} value={key}>{t(sectionStringKeys[key])}</option>
            ))}
          </select>
        </div>

        {/* Main content */}
        <main className="flex-1 p-6 bg-background overflow-auto">
          <div className="max-w-4xl mx-auto">
            <SectionComponent />
          </div>
        </main>
      </div>
    </div>
  );
}
