import { useRoute, Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProjectForReport,
  getGetProjectForReportQueryKey,
  useListAccountMappings,
  getListAccountMappingsQueryKey,
  listAccountMappings,
  useSaveMappingOverride,
  useListMappingTemplates,
  getListMappingTemplatesQueryKey,
  useSaveMappingTemplate,
  useApplyMappingTemplate,
  type AccountMapping,
  type AccountMappingConfidence,
  type AccountMappingStatus,
  type ListAccountMappingsFilter,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Search,
  Pencil,
  Save,
  Sparkles,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Loader2,
} from "lucide-react";

// ─── Badges ─────────────────────────────────────────────────────────────────
function ConfidenceBadge({ c }: { c: AccountMappingConfidence }) {
  const map: Record<AccountMappingConfidence, { label: string; cls: string }> = {
    high: { label: "Hög", cls: "bg-green-500/10 text-green-700 border-green-500/30" },
    medium: { label: "Medel", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
    low: { label: "Låg", cls: "bg-orange-500/10 text-orange-700 border-orange-500/30" },
    unmapped: { label: "Omappad", cls: "bg-red-500/10 text-red-700 border-red-500/30" },
  };
  const { label, cls } = map[c];
  return <Badge variant="outline" className={cls}>{label}</Badge>;
}

function StatusBadge({ s }: { s: AccountMappingStatus }) {
  const map: Record<AccountMappingStatus, { label: string; cls: string }> = {
    auto_mapped: { label: "Automappad", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
    suggested: { label: "Förslag", cls: "bg-purple-500/10 text-purple-700 border-purple-500/30" },
    needs_review: { label: "Behöver granskas", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
    manually_mapped: { label: "Manuell", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
    unmapped: { label: "Omappad", cls: "bg-red-500/10 text-red-700 border-red-500/30" },
  };
  const { label, cls } = map[s];
  return <Badge variant="outline" className={cls}>{label}</Badge>;
}

export function MappingPage() {
  const [, params] = useRoute("/reports/:reportId/mapping");
  const reportId = params?.reportId || "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<ListAccountMappingsFilter>("all");
  const [search, setSearch] = useState("");
  const [showHighConfidence, setShowHighConfidence] = useState(false);

  // Resolve project
  const {
    data: resolved,
    isLoading: isResolvingProject,
    error: resolveError,
  } = useGetProjectForReport(reportId, {
    query: { enabled: !!reportId, queryKey: getGetProjectForReportQueryKey(reportId) },
  });
  const projectId = resolved?.projectId ?? null;

  const queryParams = { filter, search };
  const { data: rows, isLoading: isLoadingRows } = useListAccountMappings(
    projectId ?? "",
    queryParams,
    {
      query: {
        enabled: !!projectId,
        queryKey: getListAccountMappingsQueryKey(projectId ?? "", queryParams),
      },
    },
  );

  const { data: templates } = useListMappingTemplates(projectId ?? "", {
    query: {
      enabled: !!projectId,
      queryKey: getListMappingTemplatesQueryKey(projectId ?? ""),
    },
  });

  const saveOverride = useSaveMappingOverride();
  const saveTemplate = useSaveMappingTemplate();
  const applyTemplate = useApplyMappingTemplate();

  const invalidate = () => {
    if (!projectId) return;
    queryClient.invalidateQueries({ queryKey: getListAccountMappingsQueryKey(projectId, queryParams) });
  };

  // ── Auto-apply most recent template for returning customers ──────────────
  // Hooks MUST run unconditionally on every render (rules of hooks), so this
  // sits above the early returns below. The effect itself no-ops until the
  // gating conditions are met (project resolved, mappings loaded, no manual
  // edits yet, at least one template available, and we haven't applied yet
  // this session).
  const autoAppliedRef = useRef<Set<string>>(new Set());
  const allRows = rows ?? [];
  const hasManualEdits = allRows.some((r) => r.status === "manually_mapped");
  const templateCount = templates?.length ?? 0;
  useEffect(() => {
    if (!projectId) return;
    if (autoAppliedRef.current.has(projectId)) return;
    if (applyTemplate.isPending) return;
    if (allRows.length === 0) return; // need a post-import baseline
    if (hasManualEdits) return; // user already started editing — don't overwrite
    if (!templates || templates.length === 0) return;

    const sessionKey = `mapping-template-autoapplied:${projectId}`;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(sessionKey)) {
      autoAppliedRef.current.add(projectId);
      return;
    }

    // Pick the most recent template (templates are typically returned ordered
    // by createdAt asc; take the last one).
    const latest = templates[templates.length - 1];
    if (!latest) return;

    autoAppliedRef.current.add(projectId);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(sessionKey, "1");
    }

    applyTemplate.mutate(
      { projectId, templateId: latest.id },
      {
        onSuccess: (resp) => {
          invalidate();
          if (resp.appliedCount > 0) {
            toast({
              title: "Sparad mall tillämpad",
              description: `${resp.appliedCount} kontomappningar återanvändes från "${latest.name}". Granska och justera vid behov.`,
            });
          }
        },
        onError: () => {
          // Allow retry next mount if the apply failed.
          autoAppliedRef.current.delete(projectId);
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem(sessionKey);
          }
        },
      },
    );
    // We intentionally depend only on the trigger conditions, not on the
    // mutation function identity, to keep this fire-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, allRows.length, hasManualEdits, templateCount]);

  // ── Loading / no project ─────────────────────────────────────────────────
  if (isResolvingProject) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (resolveError) {
    const status = (resolveError as { status?: number })?.status;
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <BackLink reportId={reportId} />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {status === 404
              ? "Rapporten hittades inte"
              : status === 401 || status === 403
              ? "Saknar behörighet"
              : "Kunde inte ladda rapporten"}
          </AlertTitle>
          <AlertDescription>
            {status === 404
              ? "Den begärda rapporten finns inte eller är inte längre tillgänglig."
              : status === 401 || status === 403
              ? "Du saknar behörighet till den här rapporten."
              : "Ett oväntat fel inträffade. Försök igen om en stund."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <BackLink reportId={reportId} />
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Inget projekt kopplat</AlertTitle>
          <AlertDescription>Mappning kräver ett aktivt projekt.</AlertDescription>
        </Alert>
      </div>
    );
  }

  // ── Partition by confidence ──────────────────────────────────────────────
  const all = allRows;
  const lowOrUnmapped = all.filter((r) => r.confidence === "low" || r.confidence === "unmapped" || r.status === "needs_review");
  const high = all.filter((r) => !lowOrUnmapped.includes(r) && r.confidence === "high");
  const medium = all.filter((r) => r.confidence === "medium" && !lowOrUnmapped.includes(r));

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      <BackLink reportId={reportId} />

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kontomappning</h1>
          <p className="text-muted-foreground mt-1">
            Granska och justera hur dina BAS-konton mappas mot K2/K3-rapportraderna.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ApplyTemplateButton
            templates={templates ?? []}
            applying={applyTemplate.isPending}
            onApply={(templateId) => {
              applyTemplate.mutate(
                { projectId, templateId },
                {
                  onSuccess: (resp) => {
                    invalidate();
                    toast({
                      title: "Mall tillämpad",
                      description: `${resp.appliedCount} konton uppdaterade.`,
                    });
                  },
                },
              );
            }}
          />
          <SaveTemplateButton
            saving={saveTemplate.isPending}
            onSave={async (name) => {
              // Always fetch the FULL unfiltered mapping list so the saved
              // template captures every account, not only what is currently
              // visible in the filtered/searched view.
              const fullList = await queryClient.fetchQuery({
                queryKey: getListAccountMappingsQueryKey(projectId, { filter: "all" }),
                queryFn: ({ signal }) =>
                  listAccountMappings(projectId, { filter: "all" }, { signal }),
              });
              saveTemplate.mutate(
                {
                  projectId,
                  data: {
                    name,
                    mappings: fullList
                      .filter((m) => m.reportLine)
                      .map((m) => ({
                        accountNumber: m.accountNumber,
                        reportLine: m.reportLine ?? "",
                        reportLineLabel: m.reportLineLabel ?? "",
                      })),
                  },
                },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: getListMappingTemplatesQueryKey(projectId) });
                    toast({ title: "Mall sparad", description: `"${name}" kan återanvändas.` });
                  },
                },
              );
            }}
          />
        </div>
      </div>

      {/* Adaptive guidance */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-primary hover:underline">
          <HelpCircle className="h-4 w-4" />
          Varför mappades kontona så här? Visa BAS-logik
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Alert>
            <AlertDescription className="text-sm space-y-2">
              <p>
                Kontomappningen baseras på <strong>BAS-kontoplanens</strong> standardintervall:
                t.ex. <code className="font-mono">1000–1999</code> → tillgångar,
                <code className="font-mono"> 2000–2999</code> → eget kapital och skulder,
                <code className="font-mono"> 3000–3999</code> → intäkter,
                <code className="font-mono"> 4000–7999</code> → kostnader,
                <code className="font-mono"> 8000–8999</code> → finansiella poster.
              </p>
              <p className="text-muted-foreground">
                Konfidensen är <strong>Hög</strong> för vanliga BAS-konton, <strong>Medel</strong> när
                flera rapportrader är möjliga och <strong>Låg/Omappad</strong> när kontot är okänt
                eller kundspecifikt. Vid manuell ändring kan kontot påverka noter — vi varnar då med
                en notrelaterad indikator.
              </p>
            </AlertDescription>
          </Alert>
        </CollapsibleContent>
      </Collapsible>

      {/* Filter / search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as ListAccountMappingsFilter)}>
          <TabsList>
            <TabsTrigger value="all">Alla ({all.length})</TabsTrigger>
            <TabsTrigger value="needs_review">Behöver granskas ({lowOrUnmapped.length})</TabsTrigger>
            <TabsTrigger value="low_confidence">Låg konfidens</TabsTrigger>
            <TabsTrigger value="unmapped">Omappade</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök konto eller namn…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Loading */}
      {isLoadingRows ? (
        <Skeleton className="h-64 w-full" />
      ) : all.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">
              Mappning kräver aktiv årsredovisning
            </p>
            <p className="text-sm">
              Bekräfta först en import på{" "}
              <Link href={`/reports/${reportId}/import`} className="text-primary hover:underline">
                Import-sidan
              </Link>{" "}
              för att köra automappningen. Återkommande kunder får sina sparade
              kontomappningar tillämpade automatiskt — endast eventuella
              uppdateringar behöver göras.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Needs review (always visible) */}
          {lowOrUnmapped.length > 0 && (
            <MappingSection
              title="Behöver din uppmärksamhet"
              description="Låg konfidens eller omappade konton — granska och fastställ mappningen."
              icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
              rows={lowOrUnmapped}
              projectId={projectId}
              onSaved={invalidate}
              saving={saveOverride.isPending}
              saveOverride={(payload) =>
                saveOverride.mutate(payload, { onSuccess: invalidate })
              }
              defaultOpen
            />
          )}

          {medium.length > 0 && (
            <MappingSection
              title="Medel konfidens"
              description="Antagligen rätt — granska om du vill säkerställa."
              icon={<Sparkles className="h-5 w-5 text-blue-600" />}
              rows={medium}
              projectId={projectId}
              onSaved={invalidate}
              saving={saveOverride.isPending}
              saveOverride={(payload) =>
                saveOverride.mutate(payload, { onSuccess: invalidate })
              }
              defaultOpen={filter !== "all"}
            />
          )}

          {high.length > 0 && (
            <Card>
              <CardHeader
                className="cursor-pointer flex-row items-center gap-2"
                onClick={() => setShowHighConfidence((s) => !s)}
              >
                {showHighConfidence ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <CardTitle className="text-base">{high.length} konton automappade med hög konfidens</CardTitle>
                  <CardDescription>Klicka för att granska eller justera vid behov.</CardDescription>
                </div>
              </CardHeader>
              {showHighConfidence && (
                <CardContent>
                  <MappingTable
                    rows={high}
                    projectId={projectId}
                    onSaved={invalidate}
                    saving={saveOverride.isPending}
                    saveOverride={(payload) =>
                      saveOverride.mutate(payload, { onSuccess: invalidate })
                    }
                  />
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function BackLink({ reportId }: { reportId: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Link href={`/reports/${reportId}`} className="hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" />
        Tillbaka till rapporten
      </Link>
    </div>
  );
}

interface SaveOverridePayload {
  projectId: string;
  mappingId: string;
  data: { reportLine: string; reportLineLabel: string; reason?: string };
}

function MappingSection({
  title,
  description,
  icon,
  rows,
  projectId,
  onSaved,
  saving,
  saveOverride,
  defaultOpen,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  rows: AccountMapping[];
  projectId: string;
  onSaved: () => void;
  saving: boolean;
  saveOverride: (payload: SaveOverridePayload) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <Card>
      <CardHeader className="cursor-pointer flex-row items-center gap-2" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {icon}
        <div>
          <CardTitle className="text-base">{title} ({rows.length})</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <MappingTable
            rows={rows}
            projectId={projectId}
            onSaved={onSaved}
            saving={saving}
            saveOverride={saveOverride}
          />
        </CardContent>
      )}
    </Card>
  );
}

function MappingTable({
  rows,
  projectId,
  onSaved,
  saving,
  saveOverride,
}: {
  rows: AccountMapping[];
  projectId: string;
  onSaved: () => void;
  saving: boolean;
  saveOverride: (payload: SaveOverridePayload) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Konto</TableHead>
          <TableHead>Namn</TableHead>
          <TableHead>Rapportrad</TableHead>
          <TableHead>Konfidens</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Not</TableHead>
          <TableHead className="text-right">Åtgärd</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">{row.accountNumber}</TableCell>
            <TableCell className="text-xs">{row.accountName ?? "—"}</TableCell>
            <TableCell className="text-xs">{row.reportLineLabel ?? row.reportLine ?? "—"}</TableCell>
            <TableCell><ConfidenceBadge c={row.confidence} /></TableCell>
            <TableCell><StatusBadge s={row.status} /></TableCell>
            <TableCell>
              {row.noteImpactFlag && (
                <Badge variant="outline" className="text-[10px]">
                  Kan påverka not
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <OverrideButton
                row={row}
                projectId={projectId}
                saving={saving}
                onSave={(reportLine, reportLineLabel, reason) =>
                  saveOverride({
                    projectId,
                    mappingId: row.id,
                    data: { reportLine, reportLineLabel, reason },
                  })
                }
                onSaved={onSaved}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OverrideButton({
  row,
  saving,
  onSave,
}: {
  row: AccountMapping;
  projectId: string;
  saving: boolean;
  onSave: (reportLine: string, reportLineLabel: string, reason?: string) => void;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reportLine, setReportLine] = useState(row.reportLine ?? "");
  const [reportLineLabel, setReportLineLabel] = useState(row.reportLineLabel ?? "");
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Pencil className="h-3.5 w-3.5 mr-1" />Justera</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manuell mappning</DialogTitle>
          <DialogDescription>
            Konto <span className="font-mono">{row.accountNumber}</span> {row.accountName && `— ${row.accountName}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="reportLine">Rapportradnyckel</Label>
            <Input
              id="reportLine"
              value={reportLine}
              onChange={(e) => setReportLine(e.target.value)}
              placeholder="t.ex. BR_OmsattningsTillgangar.Kassa_Bank"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              <HelpCircle className="h-3 w-3 inline mr-1" />
              Vad händer om jag åsidosätter? Kontots belopp flyttas till den valda rapportraden,
              och om kontot ingår i en notgrupp uppdateras noten i nästa beräkning.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reportLineLabel">Rapportradetikett (svensk)</Label>
            <Input
              id="reportLineLabel"
              value={reportLineLabel}
              onChange={(e) => setReportLineLabel(e.target.value)}
              placeholder="t.ex. Kassa och bank"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Skäl (valfritt)</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Kort motivering för revisionsspåret"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Avbryt</Button>
          <Button
            disabled={saving || !reportLine || !reportLineLabel}
            onClick={() => {
              onSave(reportLine, reportLineLabel, reason || undefined);
              setOpen(false);
            }}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveTemplateButton({
  saving,
  onSave,
}: {
  saving: boolean;
  onSave: (name: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Save className="h-4 w-4 mr-1" />Spara som mall</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Spara mappning som mall</DialogTitle>
          <DialogDescription>
            Du kan återanvända mallen i framtida import-batchar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="tplName">Mallnamn</Label>
          <Input id="tplName" value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Standardmall AB Exempel" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Avbryt</Button>
          <Button
            disabled={!name || saving}
            onClick={() => {
              onSave(name);
              setOpen(false);
              setName("");
            }}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplyTemplateButton({
  templates,
  applying,
  onApply,
}: {
  templates: { id: string; name: string }[];
  applying: boolean;
  onApply: (templateId: string) => void;
}) {
  const [selected, setSelected] = useState("");
  if (templates.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="w-56"><SelectValue placeholder="Välj mall…" /></SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        disabled={!selected || applying}
        onClick={() => onApply(selected)}
      >
        {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Tillämpa
      </Button>
    </div>
  );
}
