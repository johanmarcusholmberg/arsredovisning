import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import {
  ReportSummaryCard,
  type ReportSummaryMetric,
  type ReportSummarySignatory,
} from "../../../../arsredovisningar/src/components/report/ReportSummaryCard";
import { LanguageProvider } from "../../../../arsredovisningar/src/contexts/LanguageContext";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

const MOCK_REPORT = {
  id: "mock-report-1",
  companyName: "Acme Bygg & Konsult AB",
  fiscalYearStart: "2024-01-01",
  fiscalYearEnd: "2024-12-31",
  status: "complete" as const,
  accountingFramework: "K2" as const,
};

const MOCK_REPORT_DRAFT = {
  ...MOCK_REPORT,
  id: "mock-report-2",
  companyName: "Långa Namn På Företaget Norden AB",
  status: "in_progress" as const,
  accountingFramework: "K3" as const,
};

const MOCK_METRICS: ReportSummaryMetric[] = [
  { label: "Nettoomsättning", current: 18_452_000, previous: 16_120_000 },
  { label: "Rörelseresultat", current: 2_310_000, previous: 2_540_000 },
  { label: "Årets resultat", current: 1_842_500, previous: 1_205_000 },
];

const MOCK_SIGNATORIES: ReportSummarySignatory[] = [
  { name: "Anna Lindberg", role: "Styrelseordförande", signed: true },
  { name: "Erik Johansson", role: "VD", signed: true },
  { name: "Maria Karlsson", role: "Styrelseledamot", signed: false },
  { name: "Sven Åkesson", role: "Revisor", signed: false },
];

function VariantSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function CardSet() {
  return (
    <div className="space-y-8">
      <VariantSection title="row variant · complete">
        <ReportSummaryCard
          report={MOCK_REPORT}
          metrics={MOCK_METRICS}
          signatories={MOCK_SIGNATORIES}
          pageCount={24}
          outputFormat="PDF"
          variant="row"
          trailing={
            <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              Öppna rapport
              <ArrowRight className="size-3.5" />
            </button>
          }
        />
      </VariantSection>

      <VariantSection title="hero variant · in progress">
        <ReportSummaryCard
          report={MOCK_REPORT_DRAFT}
          metrics={MOCK_METRICS}
          signatories={MOCK_SIGNATORIES.slice(0, 2)}
          pageCount={18}
          outputFormat="DOCX"
          variant="hero"
        />
      </VariantSection>

      <VariantSection title="row variant · loading metrics">
        <ReportSummaryCard report={MOCK_REPORT} metricsLoading variant="row" />
      </VariantSection>

      <VariantSection title="row variant · draft, no signatories">
        <ReportSummaryCard
          report={{
            ...MOCK_REPORT,
            status: "draft" as const,
          }}
          metrics={[
            { label: "Nettoomsättning", current: 540_000, previous: null },
            { label: "Rörelseresultat", current: -12_000, previous: 80_000 },
            { label: "Årets resultat", current: null, previous: null },
          ]}
          variant="row"
        />
      </VariantSection>
    </div>
  );
}

function ThemeCanvas({
  theme,
  children,
}: {
  theme: "light" | "dark";
  children: ReactNode;
}) {
  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <div
        className="bg-background text-foreground p-6 sm:p-8 space-y-8"
        data-testid={`theme-${theme}`}
      >
        <header className="flex items-center justify-between">
          <h1 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            ReportSummaryCard · {theme}
          </h1>
        </header>
        {children}
      </div>
    </div>
  );
}

export default function ReportSummaryCardMockup() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900">
          <div className="mx-auto max-w-3xl py-6 space-y-4">
            <ThemeCanvas theme="light">
              <CardSet />
            </ThemeCanvas>
            <ThemeCanvas theme="dark">
              <CardSet />
            </ThemeCanvas>
          </div>
        </div>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
