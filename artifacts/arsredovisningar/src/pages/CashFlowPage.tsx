import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCashFlowAssessment,
  updateCashFlowAssessment,
  getCashFlowStatement,
  generateCashFlowStatement,
  updateCashFlowLine,
  addCashFlowAdjustment,
  validateCashFlow,
  updateCashFlowAccountClassification,
  type CashFlowAssessmentResponse,
  type CashFlowStatementResponse,
  type CashFlowLineItem,
  type CashFlowLineSourceAccount,
  type CashFlowValidationResponse,
  type UpdateCashFlowAssessmentBody,
  type UpdateCashFlowLineBody,
  type UpdateCashFlowAccountClassificationBody,
} from "@workspace/api-client-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Info,
  Loader2,
} from "lucide-react";

type Assessment = CashFlowAssessmentResponse;
type CFLine = CashFlowLineItem;
type CFStatement = NonNullable<CashFlowStatementResponse["statement"]>;
type CFResponse = CashFlowStatementResponse;
type CFValidationResp = CashFlowValidationResponse;

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " kr";

const SECTION_LABELS: Record<CFLine["section"], string> = {
  operating: "Den löpande verksamheten",
  investing: "Investeringsverksamheten",
  financing: "Finansieringsverksamheten",
  reconciliation: "Avstämning av likvida medel",
};

export function CashFlowPage() {
  const [, params] = useRoute("/reports/:reportId/cash-flow");
  const reportId = params?.reportId ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();

  const assessmentKey = ["cf-assessment", reportId];
  const statementKey = ["cf-statement", reportId];

  const { data: assessment, isLoading: aLoading } = useQuery<Assessment>({
    queryKey: assessmentKey,
    enabled: !!reportId,
    queryFn: () => getCashFlowAssessment(reportId),
  });

  const { data: cf, isLoading: cfLoading } = useQuery<CFResponse>({
    queryKey: statementKey,
    enabled: !!reportId,
    queryFn: () => getCashFlowStatement(reportId),
  });

  const updateAssessment = useMutation({
    mutationFn: (body: UpdateCashFlowAssessmentBody) =>
      updateCashFlowAssessment(reportId, body),
    onSuccess: (data) => {
      qc.setQueryData(assessmentKey, data);
    },
    onError: (err: Error) => {
      toast({ title: "Kunde inte uppdatera", description: err.message, variant: "destructive" });
    },
  });

  const generate = useMutation({
    mutationFn: () => generateCashFlowStatement(reportId),
    onSuccess: (data) => {
      qc.setQueryData(statementKey, data);
      toast({ title: "Kassaflödesanalys genererad", description: "Granska beloppen och bekräfta de markerade raderna." });
    },
    onError: (err: Error) => {
      toast({ title: "Genereringen misslyckades", description: err.message, variant: "destructive" });
    },
  });

  const updateLine = useMutation({
    mutationFn: ({ lineId, body }: { lineId: string; body: UpdateCashFlowLineBody }) =>
      updateCashFlowLine(reportId, lineId, body),
    onSuccess: (data) => qc.setQueryData(statementKey, data),
  });

  const addAdjustment = useMutation({
    mutationFn: (body: { lineId: string; newAmount: number; reason: string }) =>
      addCashFlowAdjustment(reportId, body),
    onSuccess: (data) => {
      qc.setQueryData(statementKey, data);
      toast({ title: "Justering sparad", description: "Den manuella justeringen är loggad i revisionsspåret." });
    },
    onError: (err: Error) => {
      toast({ title: "Justering misslyckades", description: err.message, variant: "destructive" });
    },
  });

  const validateCf = useMutation({
    mutationFn: () => validateCashFlow(reportId),
    onSuccess: (data: CFValidationResp) => {
      const blocking = data.issues.filter((i) => i.level === "blocking").length;
      toast({
        title: blocking === 0 ? "Validering OK" : `${blocking} blockerande problem`,
        description: blocking === 0
          ? "Kassaflödesanalysen är validerad och redo att inkluderas i exporten."
          : "Granska felen och åtgärda dem.",
        variant: blocking === 0 ? "default" : "destructive",
      });
      qc.invalidateQueries({ queryKey: statementKey });
    },
  });

  const [adjustOpen, setAdjustOpen] = useState<CFLine | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [remapAccount, setRemapAccount] = useState<CashFlowLineSourceAccount | null>(null);

  function openAdjust(line: CFLine) {
    setAdjustOpen(line);
    setAdjustAmount(line.amountCurrentYear === null ? "" : String(line.amountCurrentYear));
    setAdjustReason("");
  }

  if (aLoading) {
    return (
      <div className="container max-w-5xl py-8 space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!assessment) {
    return (
      <div className="container max-w-5xl py-8">
        <Alert variant="destructive">
          <AlertCircleIcon /> <AlertTitle>Kunde inte hämta kassaflödesbedömningen.</AlertTitle>
        </Alert>
      </div>
    );
  }

  const requirementBadge = (() => {
    switch (assessment.cashFlowRequirement) {
      case "mandatory":
        return <Badge className="bg-red-600">Obligatorisk</Badge>;
      case "optional":
        return <Badge variant="secondary">Frivillig</Badge>;
      case "unknown":
        return <Badge variant="outline">Behöver bekräftas</Badge>;
      case "not_supported":
        return <Badge variant="outline">Stöds ej</Badge>;
    }
  })();

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/reports/${reportId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Tillbaka till rapporten
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {requirementBadge}
          {assessment.shouldIncludeInExport && (
            <Badge variant="outline" className="border-emerald-400 text-emerald-700">
              Ingår i exporten
            </Badge>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Kassaflödesanalys</h1>
        <p className="text-muted-foreground">
          Bedöm om kassaflödesanalys krävs enligt årsredovisningslagen och bygg den indirekta kassaflödesanalysen.
        </p>
      </div>

      {/* Assessment card */}
      <Card>
        <CardHeader>
          <CardTitle>Behövs kassaflödesanalys?</CardTitle>
          <CardDescription>{assessment.explanationSv}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {assessment.missingInputs.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Vi behöver några uppgifter</AlertTitle>
              <AlertDescription>
                Fyll i medeltal anställda, balansomslutning och nettoomsättning för innevarande och föregående år så
                kan vi avgöra om kassaflödesanalys är obligatorisk.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Noterad på reglerad marknad</Label>
                <p className="text-xs text-muted-foreground">Noterade bolag är alltid större företag.</p>
              </div>
              <Switch
                checked={assessment.isListedCompany}
                onCheckedChange={(v) => updateAssessment.mutate({ isListedCompany: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Bostadsrättsförening</Label>
                <p className="text-xs text-muted-foreground">BRF ska alltid lämna kassaflödesanalys.</p>
              </div>
              <Switch
                checked={assessment.isHousingAssociation}
                onCheckedChange={(v) => updateAssessment.mutate({ isHousingAssociation: v })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <NumberField
              label="Anställda – innevarande år"
              value={assessment.employeesCurrentYear}
              onCommit={(v) => updateAssessment.mutate({ employeesCurrentYear: v })}
            />
            <NumberField
              label="Balansomslutning – innevarande år (kr)"
              value={assessment.balanceTotalCurrentYear}
              onCommit={(v) => updateAssessment.mutate({ balanceTotalCurrentYear: v })}
            />
            <NumberField
              label="Nettoomsättning – innevarande år (kr)"
              value={assessment.netRevenueCurrentYear}
              onCommit={(v) => updateAssessment.mutate({ netRevenueCurrentYear: v })}
            />
            <NumberField
              label="Anställda – föregående år"
              value={assessment.employeesPreviousYear}
              onCommit={(v) => updateAssessment.mutate({ employeesPreviousYear: v })}
            />
            <NumberField
              label="Balansomslutning – föregående år (kr)"
              value={assessment.balanceTotalPreviousYear}
              onCommit={(v) => updateAssessment.mutate({ balanceTotalPreviousYear: v })}
            />
            <NumberField
              label="Nettoomsättning – föregående år (kr)"
              value={assessment.netRevenuePreviousYear}
              onCommit={(v) => updateAssessment.mutate({ netRevenuePreviousYear: v })}
            />
          </div>

          {assessment.cashFlowRequirement === "optional" && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Inkludera frivillig kassaflödesanalys</Label>
                <p className="text-xs text-muted-foreground">
                  Du kan välja att lämna kassaflödesanalys även när det inte är obligatoriskt.
                </p>
              </div>
              <Switch
                checked={assessment.voluntaryEnabled}
                onCheckedChange={(v) => updateAssessment.mutate({ voluntaryEnabled: v })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statement editor */}
      {assessment.shouldIncludeInExport ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Kassaflödesanalys (indirekt metod)</CardTitle>
              <CardDescription>
                Genererad från resultaträkningen och balansräkningen. Granska och bekräfta de markerade raderna.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
                {generate.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {cf?.statement ? "Generera om" : "Generera"}
              </Button>
              <Button
                variant="default"
                disabled={!cf?.statement || validateCf.isPending}
                onClick={() => validateCf.mutate()}
              >
                {validateCf.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldAlert className="h-4 w-4 mr-2" />
                )}
                Validera
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {cfLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : !cf?.statement ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Ingen kassaflödesanalys ännu</AlertTitle>
                <AlertDescription>
                  Klicka på <b>Generera</b> för att skapa ett utkast från importerad data.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <ReconciliationSummary stmt={cf.statement} />
                <table className="w-full text-sm mt-4" data-testid="cash-flow-table">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr>
                      <th className="py-2">Rad</th>
                      <th className="py-2 text-right">Innevarande år</th>
                      <th className="py-2 text-right">Föregående år</th>
                      <th className="py-2 w-[40px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["operating", "investing", "financing", "reconciliation"] as const).map((sec) => {
                      const linesInSection = cf.lines.filter((l) => l.section === sec);
                      if (linesInSection.length === 0) return null;
                      return (
                        <FragmentSection
                          key={sec}
                          label={SECTION_LABELS[sec]}
                          lines={linesInSection}
                          onConfirm={(line) =>
                            updateLine.mutate({
                              lineId: line.id,
                              body: { needsReview: false, amountCurrentYear: line.amountCurrentYear },
                            })
                          }
                          onAdjust={openAdjust}
                          onRemap={setRemapAccount}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Kassaflödesanalys ingår inte i exporten</AlertTitle>
          <AlertDescription>
            Aktivera frivillig kassaflödesanalys i bedömningen ovan om du vill inkludera den.
          </AlertDescription>
        </Alert>
      )}

      {/* Adjustment dialog */}
      <Dialog open={!!adjustOpen} onOpenChange={(o) => !o && setAdjustOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manuell justering</DialogTitle>
            <DialogDescription>{adjustOpen?.labelSv}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nytt belopp (kr)</Label>
              <Input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Motivering</Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Beskriv varför detta belopp justeras (loggas i revisionsspåret)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustOpen(null)}>Avbryt</Button>
            <Button
              disabled={
                !adjustOpen ||
                adjustReason.trim().length < 3 ||
                adjustAmount === "" ||
                Number.isNaN(Number(adjustAmount)) ||
                addAdjustment.isPending
              }
              onClick={() => {
                if (!adjustOpen) return;
                addAdjustment.mutate(
                  { lineId: adjustOpen.id, newAmount: Number(adjustAmount), reason: adjustReason.trim() },
                  { onSuccess: () => setAdjustOpen(null) },
                );
              }}
            >
              Spara justering
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RemapAccountDialog
        reportId={reportId}
        account={remapAccount}
        onClose={() => setRemapAccount(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: statementKey })}
      />
    </div>
  );
}

function AlertCircleIcon() {
  return <AlertTriangle className="h-4 w-4" />;
}

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | null | undefined;
  onCommit: (v: number | null) => void;
}) {
  const [text, setText] = useState(value === null || value === undefined ? "" : String(value));
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const trimmed = text.trim();
          if (trimmed === "") onCommit(null);
          else if (!Number.isNaN(Number(trimmed))) onCommit(Number(trimmed));
        }}
      />
    </div>
  );
}

function ReconciliationSummary({ stmt }: { stmt: CFStatement }) {
  const diff = stmt.reconciliationDifference ?? null;
  const reconciled = diff !== null && Math.abs(diff) <= 1;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <SummaryTile label="Löpande verksamhet" value={stmt.cashFlowFromOperatingActivities} />
      <SummaryTile label="Investeringar" value={stmt.cashFlowFromInvestingActivities} />
      <SummaryTile label="Finansiering" value={stmt.cashFlowFromFinancingActivities} />
      <SummaryTile label="Årets kassaflöde" value={stmt.totalCashFlowForYear} highlight />
      <div className="md:col-span-4 rounded-md border p-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Avstämning mot balansräkning</div>
          <div className="text-sm">
            Beräknat utgående: <b>{fmt(stmt.calculatedClosingCashAndCashEquivalents)}</b> · Inmatat utgående:{" "}
            <b>{fmt(stmt.closingCashAndCashEquivalents)}</b>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reconciled ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">Stämmer</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">
                Differens: {fmt(diff)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | null | undefined;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-md border p-3 ${highlight ? "bg-primary/5 border-primary/30" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{fmt(value)}</div>
    </div>
  );
}

const CF_CLASSIFICATION_LABELS: Record<string, string> = {
  cash_and_cash_equivalents: "Likvida medel",
  receivables: "Rörelsefordringar",
  inventory: "Varulager",
  operating_liabilities: "Rörelseskulder",
  tax: "Skatt",
  non_cash_adjustment: "Ej kassaflödespåverkande (t.ex. avskrivningar)",
  tangible_fixed_assets: "Materiella anläggningstillgångar",
  intangible_fixed_assets: "Immateriella anläggningstillgångar",
  financial_fixed_assets: "Finansiella anläggningstillgångar",
  long_term_loans: "Långfristiga lån",
  short_term_interest_bearing_loans: "Kortfristiga räntebärande lån",
  equity: "Eget kapital",
  dividends: "Utdelning",
  other_unclear: "Ej klassificerad",
  exclude: "Exkludera från kassaflödet",
};

function FragmentSection({
  label,
  lines,
  onConfirm,
  onAdjust,
  onRemap,
}: {
  label: string;
  lines: CFLine[];
  onConfirm: (l: CFLine) => void;
  onAdjust: (l: CFLine) => void;
  onRemap: (account: CashFlowLineSourceAccount) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  return (
    <>
      <tr className="border-t">
        <td colSpan={4} className="pt-4 pb-1 font-semibold uppercase text-xs tracking-wider text-muted-foreground">
          {label}
        </td>
      </tr>
      {lines.map((l) => {
        const isOpen = !!expanded[l.id];
        const sourceAccounts = l.sourceAccounts ?? [];
        return (
          <>
            <tr key={l.id} className={`border-b last:border-b-0 ${l.isSubtotal ? "font-semibold bg-muted/30" : ""}`}>
              <td className="py-2 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{l.labelSv}</span>
                  {l.needsReview && (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 text-[10px]">
                      Granska
                    </Badge>
                  )}
                  {l.sourceType === "manual_adjustment" && (
                    <Badge variant="outline" className="text-[10px]">Manuell</Badge>
                  )}
                  {sourceAccounts.length > 0 && !l.isSubtotal && (
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [l.id]: !prev[l.id] }))}
                      className="text-[10px] text-primary underline"
                    >
                      {isOpen ? "Dölj källkonton" : `Visa källkonton (${sourceAccounts.length})`}
                    </button>
                  )}
                </div>
                {l.calculationExplanationSv && !l.isSubtotal && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">{l.calculationExplanationSv}</div>
                )}
              </td>
              <td className="py-2 text-right tabular-nums">{fmt(l.amountCurrentYear)}</td>
              <td className="py-2 text-right tabular-nums">{fmt(l.amountPreviousYear)}</td>
              <td className="py-2 text-right">
                {l.isEditable && !l.isSubtotal && (
                  <div className="flex justify-end gap-1">
                    {l.needsReview && (
                      <Button size="sm" variant="ghost" onClick={() => onConfirm(l)} title="Bekräfta">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => onAdjust(l)} title="Justera">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </td>
            </tr>
            {isOpen && sourceAccounts.length > 0 && (
              <tr key={`${l.id}-detail`} className="bg-muted/20 border-b">
                <td colSpan={4} className="py-2 pl-4 pr-2">
                  <table className="w-full text-[11px]">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="text-left py-1">Konto</th>
                        <th className="text-left py-1">Klassificering</th>
                        <th className="text-right py-1">IB</th>
                        <th className="text-right py-1">UB</th>
                        <th className="text-right py-1">Förändring</th>
                        <th className="text-right py-1 w-[140px]">Åtgärd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceAccounts.map((a) => (
                        <tr key={a.accountNumber} className="border-t border-border/40">
                          <td className="py-1 pr-2">
                            <span className="font-mono">{a.accountNumber}</span>
                            {a.accountName ? <span className="text-muted-foreground"> – {a.accountName}</span> : null}
                          </td>
                          <td className="py-1 pr-2">
                            <span>{CF_CLASSIFICATION_LABELS[a.classification] ?? a.classification}</span>
                            <span className="text-muted-foreground"> ({a.classificationSource})</span>
                          </td>
                          <td className="py-1 text-right tabular-nums">{fmt(a.opening ?? null)}</td>
                          <td className="py-1 text-right tabular-nums">{fmt(a.closing ?? null)}</td>
                          <td className="py-1 text-right tabular-nums">{fmt(a.movement ?? null)}</td>
                          <td className="py-1 text-right">
                            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => onRemap(a)}>
                              Klassificera om
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            )}
          </>
        );
      })}
    </>
  );
}

export function RemapAccountDialog({
  reportId,
  account,
  onClose,
  onSaved,
}: {
  reportId: string;
  account: CashFlowLineSourceAccount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [classification, setClassification] = useState<string>(account?.classification ?? "other_unclear");
  const [exclude, setExclude] = useState<boolean>(false);
  const mutation = useMutation({
    mutationFn: (body: UpdateCashFlowAccountClassificationBody) =>
      updateCashFlowAccountClassification(reportId, account!.accountNumber, body),
    onSuccess: () => {
      toast({ title: "Klassificering uppdaterad", description: "Kassaflödesanalysen räknas om." });
      onSaved();
      onClose();
    },
    onError: () => {
      toast({ title: "Kunde inte uppdatera klassificering", variant: "destructive" });
    },
  });

  return (
    <Dialog open={!!account} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Omklassificera konto {account?.accountNumber}</DialogTitle>
          <DialogDescription>
            {account?.accountName ?? "—"} · ändringen påverkar enbart kassaflödesanalysen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Ny klassificering</Label>
            <Select value={classification} onValueChange={setClassification}>
              <SelectTrigger><SelectValue placeholder="Välj klassificering" /></SelectTrigger>
              <SelectContent>
                {Object.entries(CF_CLASSIFICATION_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={exclude}
              onChange={(e) => setExclude(e.target.checked)}
            />
            Exkludera kontot helt från kassaflödesanalysen
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Avbryt</Button>
          <Button
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                classification,
                excludeFromCashFlow: exclude,
                needsManualReview: false,
                reviewReasonSv: null,
              })
            }
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CashFlowPage;
