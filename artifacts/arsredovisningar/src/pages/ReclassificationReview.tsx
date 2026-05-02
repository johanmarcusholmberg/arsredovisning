import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useListReclassificationSuggestions,
  useDetectReclassificationSuggestions,
  useUpdateReclassificationSuggestionStatus,
  useListReclassifications,
  useCreateReclassification,
  useUndoReclassification,
  useListReclassificationAuditLog,
  useGetReport,
  useListReportNotes,
  useListNoteRows,
  getListReclassificationSuggestionsQueryKey,
  getListReclassificationsQueryKey,
  getListReclassificationAuditLogQueryKey,
  getGetReportQueryKey,
  getListReportNotesQueryKey,
  getListNoteRowsQueryKey,
  type ReclassificationSuggestion,
  type Reclassification,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  RefreshCw,
  Check,
  X,
  Pencil,
  Plus,
  Undo2,
  Info,
  History,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RULE_LABELS: Record<string, string> = {
  opposite_signs_same_account: "Samma konto, motsatta tecken",
  opposite_signs_offset_pair: "Kvittningspar (BAS-grupp)",
  similar_amount_intercompany: "Närstående/koncern: spegelvänd",
  vat_inout_same_period: "Moms in/ut samma period",
  manual: "Manuell",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "Hög",
  medium: "Medel",
  low: "Låg",
};

const EVENT_LABELS: Record<string, string> = {
  suggestion_detected: "Förslag identifierat",
  suggestion_accepted: "Förslag accepterat",
  suggestion_rejected: "Förslag avvisat",
  suggestion_edited: "Förslag redigerat",
  suggestion_marked_not_relevant: "Markerat ej relevant",
  reclassification_created: "Omklassificering tillämpad",
  reclassification_undone: "Omklassificering återkallad",
};

const STATUS_LABELS: Record<string, string> = {
  suggested: "Föreslagen",
  accepted: "Accepterad",
  rejected: "Avvisad",
  edited: "Redigerad",
  not_relevant: "Ej relevant",
};

function formatAmount(value: string | undefined | null): string {
  if (value === undefined || value === null) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("sv-SE");
  } catch {
    return value;
  }
}

/**
 * Expert decision-support panel under each suggestion. Surfaces:
 *   - mapped → presented (before / after) for both source and target rows,
 *   - involved BAS account numbers,
 *   - debit/credit hint derived from the sign of the source/target amounts,
 *   - the rule's full detail JSON (for accountants who want to inspect
 *     similarity ratios, account ranges, etc.).
 *
 * The "after" amount applies the suggested netting: source loses the
 * suggested amount (drained toward zero), target gains it (filled toward
 * zero). This is the same direction the server uses.
 */
function ExpertDetailPanel({
  suggestion,
}: {
  suggestion: ReclassificationSuggestion;
}) {
  const [open, setOpen] = useState(false);
  const detail = (suggestion.detailJson ?? {}) as Record<string, unknown>;
  const sourceAmount =
    typeof detail.sourceAmount === "number"
      ? detail.sourceAmount
      : Number(detail.sourceAmount ?? NaN);
  const targetAmount =
    typeof detail.targetAmount === "number"
      ? detail.targetAmount
      : Number(detail.targetAmount ?? NaN);
  const delta = Number(suggestion.suggestedAmount);

  const sourceBefore = Number.isFinite(sourceAmount) ? sourceAmount : null;
  const targetBefore = Number.isFinite(targetAmount) ? targetAmount : null;
  const sourceAfter =
    sourceBefore !== null && Number.isFinite(delta)
      ? sourceBefore - delta
      : null;
  const targetAfter =
    targetBefore !== null && Number.isFinite(delta)
      ? targetBefore + delta
      : null;

  const sourceDc =
    sourceBefore !== null
      ? sourceBefore >= 0
        ? "Debet (fordran/tillgång)"
        : "Kredit (skuld)"
      : "—";
  const targetDc =
    targetBefore !== null
      ? targetBefore >= 0
        ? "Debet (fordran/tillgång)"
        : "Kredit (skuld)"
      : "—";
  const directionRationale =
    typeof detail.directionRationale === "string"
      ? detail.directionRationale
      : "Källan dräneras med beloppet, målet fylls upp.";

  return (
    <div className="mt-3 rounded-md border bg-muted/30">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 text-sm">
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-1">
            Källrad (dräneras)
          </div>
          <div className="font-medium">{suggestion.sourceLabel ?? "—"}</div>
          <div className="text-xs text-muted-foreground">
            Konto {suggestion.sourceAccountNumber ?? "—"} · {sourceDc}
          </div>
          <div className="font-mono mt-1">
            {formatAmount(
              sourceBefore !== null ? sourceBefore.toFixed(2) : null,
            )}
            <ArrowRight className="inline h-3 w-3 mx-1" />
            <span data-testid={`source-after-${suggestion.id}`}>
              {formatAmount(
                sourceAfter !== null ? sourceAfter.toFixed(2) : null,
              )}
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-1">
            Målrad (fylls upp)
          </div>
          <div className="font-medium">{suggestion.targetLabel ?? "—"}</div>
          <div className="text-xs text-muted-foreground">
            Konto {suggestion.targetAccountNumber ?? "—"} · {targetDc}
          </div>
          <div className="font-mono mt-1">
            {formatAmount(
              targetBefore !== null ? targetBefore.toFixed(2) : null,
            )}
            <ArrowRight className="inline h-3 w-3 mx-1" />
            <span data-testid={`target-after-${suggestion.id}`}>
              {formatAmount(
                targetAfter !== null ? targetAfter.toFixed(2) : null,
              )}
            </span>
          </div>
        </div>
      </div>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground border-t"
          >
            <span>Expertdetaljer (BAS-konton, debet/kredit, regelmotiv)</span>
            <ChevronDown
              className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3 text-xs space-y-2">
          <div>
            <span className="text-muted-foreground">Riktningsval: </span>
            {directionRationale}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Regel: </span>
              <code>{suggestion.ruleKey}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Effekt: </span>
              {suggestion.effectType}
            </div>
          </div>
          <pre className="bg-background border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all text-[11px]">
            {JSON.stringify(detail, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function ReclassificationReview() {
  const [, params] = useRoute("/reports/:reportId/reclassifications");
  const reportId = params?.reportId ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editing, setEditing] = useState<ReclassificationSuggestion | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editComment, setEditComment] = useState("");

  const [manualOpen, setManualOpen] = useState(false);
  const [manualSourceNoteId, setManualSourceNoteId] = useState<string>("");
  const [manualSourceRowId, setManualSourceRowId] = useState<string>("");
  const [manualTargetNoteId, setManualTargetNoteId] = useState<string>("");
  const [manualTargetRowId, setManualTargetRowId] = useState<string>("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualEffectType, setManualEffectType] = useState<
    "note_only" | "report_node_only" | "note_and_report_node"
  >("note_only");

  const { data: report } = useGetReport(reportId, {
    query: { enabled: !!reportId, queryKey: getGetReportQueryKey(reportId) },
  });

  const { data: notesResp } = useListReportNotes(reportId, {
    query: { enabled: !!reportId, queryKey: getListReportNotesQueryKey(reportId) },
  });

  const { data: suggestionsResp, isLoading: loadingSuggestions } =
    useListReclassificationSuggestions(reportId, undefined, {
      query: {
        enabled: !!reportId,
        queryKey: getListReclassificationSuggestionsQueryKey(reportId),
      },
    });

  const { data: reclassResp, isLoading: loadingReclass } = useListReclassifications(
    reportId,
    undefined,
    {
      query: {
        enabled: !!reportId,
        queryKey: getListReclassificationsQueryKey(reportId),
      },
    },
  );

  const { data: auditResp } = useListReclassificationAuditLog(reportId, undefined, {
    query: {
      enabled: !!reportId,
      queryKey: getListReclassificationAuditLogQueryKey(reportId),
    },
  });

  const detect = useDetectReclassificationSuggestions();
  const updateSuggestion = useUpdateReclassificationSuggestionStatus();
  const createReclass = useCreateReclassification();
  const undoReclass = useUndoReclassification();

  const { data: sourceRowsResp } = useListNoteRows(
    reportId,
    manualSourceNoteId,
    {
      query: {
        enabled: !!reportId && !!manualSourceNoteId,
        queryKey: manualSourceNoteId
          ? getListNoteRowsQueryKey(reportId, manualSourceNoteId)
          : ["disabled-source-rows"],
      },
    },
  );

  const { data: targetRowsResp } = useListNoteRows(
    reportId,
    manualTargetNoteId,
    {
      query: {
        enabled: !!reportId && !!manualTargetNoteId,
        queryKey: manualTargetNoteId
          ? getListNoteRowsQueryKey(reportId, manualTargetNoteId)
          : ["disabled-target-rows"],
      },
    },
  );

  const sourceRows = useMemo(() => sourceRowsResp?.rows ?? [], [sourceRowsResp]);
  const targetRows = useMemo(() => targetRowsResp?.rows ?? [], [targetRowsResp]);

  const noteOptions = useMemo(() => notesResp?.notes ?? [], [notesResp]);

  const invalidateAll = () => {
    qc.invalidateQueries({
      queryKey: getListReclassificationSuggestionsQueryKey(reportId),
    });
    qc.invalidateQueries({
      queryKey: getListReclassificationsQueryKey(reportId),
    });
    qc.invalidateQueries({
      queryKey: getListReclassificationAuditLogQueryKey(reportId),
    });
  };

  const handleDetect = () => {
    detect.mutate(
      { reportId },
      {
        onSuccess: (resp) => {
          invalidateAll();
          toast({
            title: "Identifiering klar",
            description: `${resp.inserted} nya förslag, ${resp.skippedAsDuplicates} hoppades över.`,
          });
        },
        onError: (err) => {
          toast({
            title: "Kunde inte köra identifiering",
            description: err instanceof Error ? err.message : "Okänt fel",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleQuickAction = (
    s: ReclassificationSuggestion,
    status: "accepted" | "rejected" | "not_relevant",
  ) => {
    // The server applies an accepted suggestion atomically (it inserts the
    // matching reclassification in the same transaction), so we no longer
    // need a follow-up POST here. Just invalidate so the new reclass row
    // appears in the "Tillämpade" tab.
    updateSuggestion.mutate(
      {
        reportId,
        suggestionId: s.id,
        data: { status },
      },
      {
        onSuccess: () => {
          invalidateAll();
          toast({
            title:
              status === "accepted"
                ? "Förslag accepterat och tillämpat"
                : "Förslag uppdaterat",
            description: STATUS_LABELS[status] ?? status,
          });
        },
        onError: (err) =>
          toast({
            title: "Kunde inte uppdatera förslag",
            description: err instanceof Error ? err.message : "Okänt fel",
            variant: "destructive",
          }),
      },
    );
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    if (editAmount && Number(editAmount) <= 0) {
      toast({
        title: "Ogiltigt belopp",
        description:
          "Beloppet måste vara positivt. Riktningen styrs av käll-/målrad.",
        variant: "destructive",
      });
      return;
    }
    updateSuggestion.mutate(
      {
        reportId,
        suggestionId: editing.id,
        data: {
          status: "edited",
          editedAmount: editAmount || null,
          reviewerComment: editComment || null,
        },
      },
      {
        onSuccess: () => {
          invalidateAll();
          setEditing(null);
          setEditAmount("");
          setEditComment("");
          toast({ title: "Ändringen sparad" });
        },
      },
    );
  };

  const handleManualSave = () => {
    if (!manualTargetRowId || !manualAmount) {
      toast({
        title: "Ofullständig omklassificering",
        description: "Välj en målrad och ange ett belopp.",
        variant: "destructive",
      });
      return;
    }
    const srcLabel = manualSourceRowId
      ? sourceRows.find((r) => r.id === manualSourceRowId)?.label ?? null
      : null;
    const tgtLabel =
      targetRows.find((r) => r.id === manualTargetRowId)?.label ?? null;
    if (Number(manualAmount) <= 0) {
      toast({
        title: "Ogiltigt belopp",
        description:
          "Ange ett positivt belopp. Riktningen styrs av käll- och målrad.",
        variant: "destructive",
      });
      return;
    }
    createReclass.mutate(
      {
        reportId,
        data: {
          sourceNoteRowId: manualSourceRowId || null,
          targetNoteRowId: manualTargetRowId,
          sourceLabel: srcLabel,
          targetLabel: tgtLabel,
          amount: manualAmount,
          effectType: manualEffectType,
          reason: manualReason || null,
        },
      },
      {
        onSuccess: () => {
          invalidateAll();
          setManualOpen(false);
          setManualSourceNoteId("");
          setManualSourceRowId("");
          setManualTargetNoteId("");
          setManualTargetRowId("");
          setManualAmount("");
          setManualReason("");
          setManualEffectType("note_only");
          toast({ title: "Omklassificering tillämpad" });
        },
        onError: (err) =>
          toast({
            title: "Kunde inte spara omklassificering",
            description: err instanceof Error ? err.message : "Okänt fel",
            variant: "destructive",
          }),
      },
    );
  };

  const handleUndo = (r: Reclassification) => {
    undoReclass.mutate(
      { reportId, reclassId: r.id },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Omklassificering återkallad" });
        },
        onError: (err) =>
          toast({
            title: "Kunde inte återkalla",
            description: err instanceof Error ? err.message : "Okänt fel",
            variant: "destructive",
          }),
      },
    );
  };

  const suggestions = suggestionsResp?.suggestions ?? [];
  const pending = suggestions.filter((s) => s.status === "suggested");
  const decided = suggestions.filter((s) => s.status !== "suggested");
  const reclassifications = reclassResp?.reclassifications ?? [];
  const auditEntries = auditResp?.entries ?? [];

  if (!reportId) {
    return <div>Rapport saknas.</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <Link
          href={`/reports/${reportId}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Tillbaka till rapport{report?.companyName ? ` — ${report.companyName}` : ""}
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDetect}
            disabled={detect.isPending}
          >
            {detect.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Identifiera förslag
          </Button>
          <Button onClick={() => setManualOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Manuell omklassificering
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Omklassificeringar mellan noter
        </h1>
        <p className="text-muted-foreground mt-1">
          Granska föreslagna omflyttningar och kvittningar mellan noter.
          Alla beslut sparas i revisionsspåret och kan återkallas.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Så här fungerar det</AlertTitle>
        <AlertDescription>
          Förslagen är regelbaserade utgångspunkter — granska och justera dem
          innan du tillämpar. Klicka på <strong>Identifiera förslag</strong> för
          att köra reglerna mot aktuella noter. Accepterade förslag sparas som
          omklassificeringar och påverkar presentationen i finansiella rapporter.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="suggestions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="suggestions">
            Förslag ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="applied">
            Tillämpade ({reclassifications.filter((r) => r.status === "active").length})
          </TabsTrigger>
          <TabsTrigger value="history">
            Beslutshistorik ({decided.length})
          </TabsTrigger>
          <TabsTrigger value="audit">Revisionsspår</TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="space-y-3">
          {loadingSuggestions ? (
            <Skeleton className="h-32 w-full" />
          ) : pending.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Inga väntande förslag. Klicka på{" "}
                <strong>Identifiera förslag</strong> för att köra reglerna.
              </CardContent>
            </Card>
          ) : (
            pending.map((s) => (
              <Card key={s.id} className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge variant="outline">{RULE_LABELS[s.ruleKey] ?? s.ruleKey}</Badge>
                        <Badge variant="secondary">
                          {CONFIDENCE_LABELS[s.confidenceLevel] ?? s.confidenceLevel}
                        </Badge>
                        <span>
                          {s.sourceLabel ?? "—"}{" "}
                          <ArrowRight className="inline h-3 w-3 mx-1" />{" "}
                          {s.targetLabel ?? "—"}
                        </span>
                      </CardTitle>
                      {s.explanation && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {s.explanation}
                        </p>
                      )}
                    </div>
                    <div className="font-mono text-lg font-semibold whitespace-nowrap">
                      {formatAmount(s.suggestedAmount)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ExpertDetailPanel suggestion={s} />
                </CardContent>
                <CardContent className="flex flex-wrap items-center gap-2 pt-0">
                  <Button
                    size="sm"
                    onClick={() => handleQuickAction(s, "accepted")}
                    disabled={updateSuggestion.isPending || createReclass.isPending}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    Acceptera & tillämpa
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(s);
                      setEditAmount(s.suggestedAmount);
                      setEditComment(s.reviewerComment ?? "");
                    }}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Redigera
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickAction(s, "rejected")}
                    disabled={updateSuggestion.isPending}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Avvisa
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleQuickAction(s, "not_relevant")}
                    disabled={updateSuggestion.isPending}
                  >
                    Ej relevant
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="applied" className="space-y-3">
          {loadingReclass ? (
            <Skeleton className="h-32 w-full" />
          ) : reclassifications.filter((r) => r.status === "active").length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Inga tillämpade omklassificeringar ännu.
              </CardContent>
            </Card>
          ) : (
            reclassifications
              .filter((r) => r.status === "active")
              .map((r) => (
                <Card key={r.id} className="shadow-sm">
                  <CardContent className="py-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {r.sourceLabel ?? "—"}{" "}
                        <ArrowRight className="inline h-3 w-3 mx-1" />{" "}
                        {r.targetLabel ?? "—"}
                      </div>
                      {r.reason && (
                        <p className="text-sm text-muted-foreground mt-1">{r.reason}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Tillämpad {formatDate(r.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-lg font-semibold">
                        {formatAmount(r.amount)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUndo(r)}
                        disabled={undoReclass.isPending}
                      >
                        <Undo2 className="mr-1 h-3 w-3" />
                        Återkalla
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {decided.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Inga beslut ännu.
              </CardContent>
            </Card>
          ) : (
            decided.map((s) => (
              <Card key={s.id} className="shadow-sm">
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm">
                      <Badge variant="outline" className="mr-2">
                        {STATUS_LABELS[s.status] ?? s.status}
                      </Badge>
                      {s.sourceLabel ?? "—"}{" "}
                      <ArrowRight className="inline h-3 w-3 mx-1" />{" "}
                      {s.targetLabel ?? "—"}
                    </div>
                    {s.reviewerComment && (
                      <p className="text-xs text-muted-foreground mt-1">
                        “{s.reviewerComment}”
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Beslutad {formatDate(s.reviewedAt)}
                    </p>
                  </div>
                  <span className="font-mono text-sm">
                    {formatAmount(s.suggestedAmount)}
                  </span>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="audit" className="space-y-2">
          {auditEntries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Inga händelser i revisionsspåret ännu.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-4 divide-y">
                {auditEntries.map((e) => (
                  <div
                    key={e.id}
                    className="py-2 flex items-start justify-between gap-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <History className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">
                        {EVENT_LABELS[e.eventType] ?? e.eventType}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(e.createdAt)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit suggestion dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setEditAmount("");
            setEditComment("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera förslag</DialogTitle>
            <DialogDescription>
              Justera beloppet eller lägg till en kommentar. Status sätts till{" "}
              <em>redigerad</em> tills du tillämpar förslaget.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-amount">Belopp</Label>
              <Input
                id="edit-amount"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="edit-comment">Kommentar</Label>
              <Textarea
                id="edit-comment"
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Avbryt
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateSuggestion.isPending}>
              {updateSuggestion.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual reclassification dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manuell omklassificering</DialogTitle>
            <DialogDescription>
              Flytta ett belopp mellan två noter manuellt. Ange en motivering så
              att granskaren förstår varför.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Källnot (valfri)</Label>
                <Select
                  value={manualSourceNoteId}
                  onValueChange={(v) => {
                    setManualSourceNoteId(v);
                    setManualSourceRowId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj not…" />
                  </SelectTrigger>
                  <SelectContent>
                    {noteOptions.map((n) => (
                      <SelectItem key={`src-note-${n.id}`} value={n.id}>
                        {n.noteNumber ? `Not ${n.noteNumber} — ` : ""}
                        {n.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Källrad</Label>
                <Select
                  value={manualSourceRowId}
                  onValueChange={setManualSourceRowId}
                  disabled={!manualSourceNoteId || sourceRows.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj rad…" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceRows.map((r) => (
                      <SelectItem key={`src-row-${r.id}`} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Målnot</Label>
                <Select
                  value={manualTargetNoteId}
                  onValueChange={(v) => {
                    setManualTargetNoteId(v);
                    setManualTargetRowId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj not…" />
                  </SelectTrigger>
                  <SelectContent>
                    {noteOptions.map((n) => (
                      <SelectItem key={`tgt-note-${n.id}`} value={n.id}>
                        {n.noteNumber ? `Not ${n.noteNumber} — ` : ""}
                        {n.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Målrad</Label>
                <Select
                  value={manualTargetRowId}
                  onValueChange={setManualTargetRowId}
                  disabled={!manualTargetNoteId || targetRows.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj rad…" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetRows.map((r) => (
                      <SelectItem key={`tgt-row-${r.id}`} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="manual-amount">Belopp (positivt)</Label>
              <Input
                id="manual-amount"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Riktningen sätts av käll- och målrad — ange aldrig minustecken.
              </p>
            </div>
            <div>
              <Label>Effekt</Label>
              <Select
                value={manualEffectType}
                onValueChange={(v) =>
                  setManualEffectType(
                    v as
                      | "note_only"
                      | "report_node_only"
                      | "note_and_report_node",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="note_only">
                    Endast not (BR/RR oförändrad)
                  </SelectItem>
                  <SelectItem value="report_node_only">
                    Endast rapportpost (BR/RR-omklassning)
                  </SelectItem>
                  <SelectItem value="note_and_report_node">
                    Både not och rapportpost
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Välj hur omklassificeringen ska påverka rapporten — bara noten,
                bara rapportposten, eller båda.
              </p>
            </div>
            <div>
              <Label htmlFor="manual-reason">Motivering</Label>
              <Textarea
                id="manual-reason"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleManualSave} disabled={createReclass.isPending}>
              {createReclass.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Tillämpa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
