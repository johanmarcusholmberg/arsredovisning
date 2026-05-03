import { useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetFinancialStatements,
  getGetFinancialStatementsQueryKey,
  useGenerateFinancialStatements,
  useGetReportStructure,
  getGetReportStructureQueryKey,
  useUpdateProjectFramework,
} from "@workspace/api-client-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  RefreshCw,
  Loader2,
  LayoutList,
  CheckCircle2,
  Clock,
  Minus,
  Info,
  Sparkles,
  ArrowLeft,
  WavesLadder,
} from "lucide-react";
import { StatementTable } from "@/components/StatementTable";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// ─── Report Structure Tab ──────────────────────────────────────────────────

function ReportStructureTab({ reportId }: { reportId: string }) {
  const { data, isLoading } = useGetReportStructure(reportId, {
    query: { enabled: !!reportId, queryKey: getGetReportStructureQueryKey(reportId) },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  if (!data) return null;

  const statusIcon = (included: boolean, conditional: boolean) => {
    if (included) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (conditional) return <Clock className="h-4 w-4 text-amber-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground/40" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="font-mono">{data.framework}</Badge>
        {data.isBrf && (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 border-transparent">
            BRF-terminologi
          </Badge>
        )}
        {data.cashFlowRequired && (
          <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-transparent">
            Kassaflödesanalys krävs
          </Badge>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-[2rem_1fr_130px] bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border">
          <span>#</span>
          <span>Avsnitt</span>
          <span className="text-right">Status</span>
        </div>
        {data.sections.map((section, idx) => (
          <div
            key={section.key}
            className="grid grid-cols-[2rem_1fr_130px] px-4 py-3 items-center border-b border-border last:border-0 hover:bg-muted/10 transition-colors"
          >
            <span className="text-xs font-mono text-muted-foreground/60">{idx + 1}</span>
            <div>
              <p className="text-sm font-medium">{section.sweLabel}</p>
              {section.conditionNote && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" />
                  {section.conditionNote}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-1.5 text-xs">
              {statusIcon(section.included, section.conditional)}
              <span className={section.included ? "text-green-700" : section.conditional ? "text-amber-700" : "text-muted-foreground/50"}>
                {section.included ? "Inkluderad" : section.conditional ? "Villkorlig" : "Ej tillämplig"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Framework Selector ────────────────────────────────────────────────────

function FrameworkSelector({
  reportId,
  currentFramework,
  onChanged,
}: {
  reportId: string;
  currentFramework: "K2" | "K3";
  onChanged: (triggerRegenerate: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<"K2" | "K3">(currentFramework);
  const updateFramework = useUpdateProjectFramework();
  const { toast } = useToast();

  const handleConfirm = () => {
    updateFramework.mutate(
      { reportId, data: { accountingFramework: selected, regenerateStatements: true } },
      {
        onSuccess: () => {
          toast({ title: "Ramverk uppdaterat", description: `Ändrat till ${selected}. Regenererar rader…` });
          setOpen(false);
          onChanged(true);
        },
        onError: () => toast({ title: "Fel", description: "Kunde inte uppdatera ramverk.", variant: "destructive" }),
      },
    );
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
      >
        <span className="text-muted-foreground">Ramverk:</span>
        <Badge variant="outline" className="font-mono text-xs h-4 px-1">{currentFramework}</Badge>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Byt redovisningsramverk</DialogTitle>
            <DialogDescription>
              Att byta ramverk regenererar alla finansiella rapportrader. Manuella
              justeringar och notreferenser behålls inte.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={selected} onValueChange={(v) => setSelected(v as "K2" | "K3")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="K3">K3 — Större och medelstora företag</SelectItem>
                <SelectItem value="K2">K2 — Mindre företag (förenklingsregler)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
            <Button onClick={handleConfirm} disabled={selected === currentFramework || updateFramework.isPending}>
              {updateFramework.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Byt till {selected}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export function FinancialStatements() {
  const [, params] = useRoute("/reports/:reportId/statements");
  const [, navigate] = useLocation();
  const reportId = params?.reportId ?? "";
  const [activeTab, setActiveTab] = useState("resultatrakning");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useGetFinancialStatements(
    reportId,
    {},
    { query: { enabled: !!reportId, queryKey: getGetFinancialStatementsQueryKey(reportId) } },
  );

  const generate = useGenerateFinancialStatements();

  const handleGenerate = () => {
    generate.mutate(
      { reportId, data: {} },
      {
        onSuccess: (res) => {
          toast({ title: "Rapporter genererade", description: res.message });
          queryClient.invalidateQueries({ queryKey: getGetFinancialStatementsQueryKey(reportId) });
          queryClient.invalidateQueries({ queryKey: getGetReportStructureQueryKey(reportId) });
        },
        onError: () => toast({ title: "Fel", description: "Kunde inte generera finansiella rapporter.", variant: "destructive" }),
      },
    );
  };

  const handleFrameworkChanged = (triggerRegenerate: boolean) => {
    queryClient.invalidateQueries({ queryKey: getGetFinancialStatementsQueryKey(reportId) });
    queryClient.invalidateQueries({ queryKey: getGetReportStructureQueryKey(reportId) });
    if (triggerRegenerate) {
      generate.mutate(
        { reportId, data: {} },
        {
          onSuccess: (res) => {
            toast({ title: "Rader regenererade", description: res.message });
            queryClient.invalidateQueries({ queryKey: getGetFinancialStatementsQueryKey(reportId) });
            queryClient.invalidateQueries({ queryKey: getGetReportStructureQueryKey(reportId) });
          },
        },
      );
    }
  };

  const handleLineUpdated = () => {
    queryClient.invalidateQueries({ queryKey: getGetFinancialStatementsQueryKey(reportId) });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const hasLines = data?.hasAnyLines ?? false;
  const framework = (data?.framework ?? "K3") as "K2" | "K3";
  const cashFlowRequired = data?.cashFlowRequired ?? false;
  const hasCashFlowLines = (data?.cashFlow?.length ?? 0) > 0;
  // Show the tab when the analysis is required by the framework, OR when the
  // user has voluntarily generated cash-flow lines for the report. Hidden for
  // K2 reports without an override so the workspace stays focused on what
  // actually applies.
  const showCashFlowTab = cashFlowRequired || hasCashFlowLines;

  // React to framework switches: bring the cash-flow tab into focus when it
  // becomes required (e.g. K2 → K3), and step back to the income statement if
  // the user was viewing a tab that just disappeared (e.g. K3 → K2 with no
  // existing cash-flow lines).
  const prevFrameworkRef = useRef<"K2" | "K3" | null>(null);
  useEffect(() => {
    const prev = prevFrameworkRef.current;
    if (prev && prev !== framework) {
      if (framework === "K3" && cashFlowRequired) {
        setActiveTab("kassaflode");
        toast({
          title: "Kassaflödesanalys krävs nu",
          description: "K3 kräver kassaflödesanalys — fliken har lyfts fram.",
        });
      } else if (framework === "K2" && !showCashFlowTab) {
        setActiveTab((current) =>
          current === "kassaflode" ? "resultatrakning" : current,
        );
      }
    }
    prevFrameworkRef.current = framework;
    // We deliberately do not depend on `toast`; it is stable from the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framework, cashFlowRequired, showCashFlowTab]);

  // If the active tab was hidden while we were on it (e.g. data loaded after
  // a framework switch), gracefully fall back to the income statement.
  useEffect(() => {
    if (activeTab === "kassaflode" && !showCashFlowTab) {
      setActiveTab("resultatrakning");
    }
  }, [activeTab, showCashFlowTab]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/reports/${reportId}`)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Tillbaka till arbetsytan"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Finansiella rapporter</h2>
            <p className="text-xs text-muted-foreground">Resultaträkning, balansräkning och kassaflödesanalys</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasLines && (
            <FrameworkSelector reportId={reportId} currentFramework={framework} onChanged={handleFrameworkChanged} />
          )}
          <Button size="sm" variant={hasLines ? "outline" : "default"} onClick={handleGenerate} disabled={generate.isPending}>
            {generate.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : hasLines ? <RefreshCw className="mr-2 h-3.5 w-3.5" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
            {hasLines ? "Regenerera" : "Generera finansiella rapporter"}
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {!hasLines && (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center">
              <BarChart3 className="h-8 w-8 text-primary/40" />
            </div>
            <div>
              <h3 className="font-semibold text-xl">Inga rapportrader ännu</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Generera resultaträkning och balansräkning baserat på{" "}
                <span className="font-medium">{framework}-ramverket</span>.
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={generate.isPending} className="mt-2">
              {generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generera finansiella rapporter
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sub-tabs */}
      {hasLines && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto pb-0 gap-1 mb-4">
            {[
              { value: "resultatrakning", icon: BarChart3, label: "Resultaträkning", badge: null as string | null, hidden: false },
              { value: "balansrakning", icon: LayoutList, label: "Balansräkning", badge: null, hidden: false },
              {
                value: "kassaflode",
                icon: WavesLadder,
                label: "Kassaflödesanalys",
                // "Krävs" makes the framework-driven obligation visible at a
                // glance when K3 is active; "Frivillig" signals that lines
                // exist on a K2 report but aren't mandatory.
                badge: cashFlowRequired ? "Krävs" : hasCashFlowLines ? "Frivillig" : null,
                hidden: !showCashFlowTab,
              },
              { value: "rapportstruktur", icon: LayoutList, label: "Rapportstruktur", badge: null, hidden: false },
            ]
              .filter((t) => !t.hidden)
              .map(({ value, icon: Icon, label, badge }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2"
                >
                  <Icon className="h-3.5 w-3.5 mr-1.5" />
                  {label}
                  {badge && (
                    <Badge
                      variant="secondary"
                      className={
                        "ml-2 h-4 px-1.5 text-[10px] border-transparent " +
                        (badge === "Krävs"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      {badge}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
          </TabsList>

          <TabsContent value="resultatrakning" className="mt-0">
            <StatementTable
              lines={data?.incomeStatement ?? []}
              reportId={reportId}
              statementType="income_statement"
              onLineUpdated={handleLineUpdated}
            />
          </TabsContent>

          <TabsContent value="balansrakning" className="mt-0">
            <StatementTable
              lines={data?.balanceSheet ?? []}
              reportId={reportId}
              statementType="balance_sheet"
              onLineUpdated={handleLineUpdated}
            />
          </TabsContent>

          <TabsContent value="kassaflode" className="mt-0">
            {cashFlowRequired || (data?.cashFlow && data.cashFlow.length > 0) ? (
              <StatementTable
                lines={data?.cashFlow ?? []}
                reportId={reportId}
                statementType="cash_flow"
                onLineUpdated={handleLineUpdated}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <WavesLadder className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Kassaflödesanalys krävs inte</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md">
                    Kassaflödesanalys krävs enligt K3 och för större företag.
                    Ramverket <span className="font-medium">{framework}</span> kräver
                    normalt inte kassaflödesanalys, men du kan inkludera den manuellt.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    generate.mutate(
                      { reportId, data: { forceCashFlow: true } },
                      {
                        onSuccess: (res) => {
                          toast({ title: "Kassaflödesanalys aktiverad", description: res.message });
                          queryClient.invalidateQueries({ queryKey: getGetFinancialStatementsQueryKey(reportId) });
                        },
                        onError: () => toast({ title: "Fel", description: "Kunde inte aktivera kassaflödesanalys.", variant: "destructive" }),
                      },
                    );
                  }}
                  disabled={generate.isPending}
                >
                  {generate.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <WavesLadder className="mr-2 h-3.5 w-3.5" />}
                  Inkludera kassaflödesanalys ändå
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="rapportstruktur" className="mt-0">
            <ReportStructureTab reportId={reportId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
