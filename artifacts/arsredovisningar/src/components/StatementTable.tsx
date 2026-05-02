import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  FileText,
  BookOpen,
  Pencil,
  RotateCcw,
  Info,
} from "lucide-react";
import {
  useGetStatementLineDrilldown,
  getGetStatementLineDrilldownQueryKey,
  useUpdateStatementLine,
  useSavePreviousYearValues,
  useListReportNotes,
  getListReportNotesQueryKey,
} from "@workspace/api-client-react";
import type { FinancialStatementLine } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ArrowUpRight } from "lucide-react";

interface StatementTableProps {
  lines: FinancialStatementLine[];
  reportId: string;
  statementType: "income_statement" | "balance_sheet" | "cash_flow";
  onLineUpdated?: () => void;
}

function formatAmount(val: string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Render the line's presented amount (mapped value + active
 * reclassification delta). Shows a subtle indicator when the line is
 * affected by an approved reclassification so users can tell at a glance
 * that the value has been netted, with a hover tooltip showing the
 * mapped value, the inflows/outflows, and the resulting net delta.
 *
 * This component is the single rendering site for statement amounts —
 * keeping it centralized prevents future code paths from accidentally
 * displaying the raw `currentYearAmount` and skipping the presentation
 * adjustment.
 */
function PresentedAmountCell({ line }: { line: FinancialStatementLine }) {
  const presented = line.presentedCurrentYearAmount ?? line.currentYearAmount;
  const delta = line.reclassificationDelta ?? null;
  const hasDelta = delta !== null && Number(delta.netDelta) !== 0;
  const tooltip = hasDelta
    ? `Mappat: ${formatAmount(line.currentYearAmount)} · ` +
      `Inflöden: ${formatAmount(delta.inflowsCurrentYear)} · ` +
      `Utflöden: ${formatAmount(delta.outflowsCurrentYear)} · ` +
      `Netto: ${formatAmount(delta.netDelta)}`
    : undefined;
  return (
    <span className="inline-flex items-center gap-1" title={tooltip}>
      {hasDelta && (
        <span
          className="inline-flex items-center rounded-sm border border-amber-300 bg-amber-50 px-1 py-0 text-[10px] font-semibold uppercase text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          aria-label="Omklassificerad"
          data-testid={`reclass-indicator-${line.id}`}
        >
          Omkl.
        </span>
      )}
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          line.isTotal && "text-base font-bold",
          line.isSubtotal && "font-semibold",
        )}
        data-testid={`presented-amount-${line.id}`}
      >
        {formatAmount(presented)}
      </span>
    </span>
  );
}

// ─── Note Reference Cell ──────────────────────────────────────────────────────

function NoteReferenceCell({
  line,
  reportId,
  onUpdated,
}: {
  line: FinancialStatementLine;
  reportId: string;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(line.noteReferenceText ?? "");
  const update = useUpdateStatementLine();
  const [, navigate] = useLocation();

  // Look up the note ids that match the badge ("1, 2" → [noteId1, noteId2]).
  // useQuery dedupes by queryKey so concurrent rows share one network call.
  const { data: notesData } = useListReportNotes(reportId, {
    query: { enabled: !!line.noteReferenceText, queryKey: getListReportNotesQueryKey(reportId) },
  });
  const linkedNoteIds: Array<{ number: number; id: string; title: string }> = (() => {
    if (!line.noteReferenceText || !notesData?.notes) return [];
    const refs = line.noteReferenceText
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));
    return refs
      .map((num) => {
        const note = notesData.notes.find((n) => n.noteNumber === num);
        return note ? { number: num, id: note.id, title: note.title } : null;
      })
      .filter((x): x is { number: number; id: string; title: string } => x !== null);
  })();

  const handleSave = () => {
    update.mutate(
      { reportId, lineId: line.id, data: { noteReferenceText: draft || null } },
      {
        onSuccess: () => {
          setOpen(false);
          onUpdated();
        },
      },
    );
  };

  const hasRef = !!line.noteReferenceText;
  const isSuggested = !!(line as FinancialStatementLine & { suggestedNoteType?: string }).suggestedNoteType && !hasRef;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-6 min-w-[2.5rem] px-1.5 rounded text-xs font-mono transition-colors border",
            hasRef
              ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
              : isSuggested
              ? "bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/20"
              : "bg-transparent text-muted-foreground/30 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 hover:text-muted-foreground/60",
          )}
          title={isSuggested ? "Notreferens föreslagen — klicka för att bekräfta" : hasRef ? "Redigera notreferens" : "Lägg till notreferens"}
        >
          {hasRef ? `Not ${line.noteReferenceText}` : isSuggested ? "?" : "—"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="center">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3 w-3" />
            Notreferens
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{line.swedishLabel}</p>
          {linkedNoteIds.length > 0 && (
            <div className="rounded border border-border divide-y bg-muted/20">
              {linkedNoteIds.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    navigate(`/reports/${reportId}/notes?open=${n.id}`);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-xs text-left hover:bg-primary/10 transition-colors"
                  data-testid={`button-open-note-${n.number}`}
                >
                  <span className="font-medium">Not {n.number}</span>
                  <span className="truncate text-muted-foreground flex-1">{n.title}</span>
                  <ArrowUpRight className="h-3 w-3 text-primary shrink-0" />
                </button>
              ))}
            </div>
          )}
          {isSuggested && (
            <div className="flex items-start gap-1.5 rounded bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              Not av typ &ldquo;{(line as FinancialStatementLine & { suggestedNoteType?: string }).suggestedNoteType}&rdquo; föreslås för denna rad.
            </div>
          )}
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="t.ex. 3 eller 3, 4"
            className="h-7 text-xs font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setOpen(false);
            }}
            autoFocus
          />
          <div className="flex gap-1 pt-1">
            <Button size="sm" className="h-6 text-xs flex-1" onClick={handleSave} disabled={update.isPending}>
              Spara
            </Button>
            {hasRef && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs text-destructive hover:text-destructive"
                onClick={() => {
                  setDraft("");
                  update.mutate(
                    { reportId, lineId: line.id, data: { noteReferenceText: null } },
                    { onSuccess: () => { setOpen(false); onUpdated(); } },
                  );
                }}
              >
                Ta bort
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Drilldown Panel ──────────────────────────────────────────────────────────

function DrilldownPanel({ line, reportId }: { line: FinancialStatementLine; reportId: string }) {
  const { data, isLoading } = useGetStatementLineDrilldown(reportId, line.id, {
    query: {
      enabled: true,
      queryKey: getGetStatementLineDrilldownQueryKey(reportId, line.id),
    },
  });

  if (isLoading) {
    return (
      <div className="py-4 px-6 text-sm text-muted-foreground animate-pulse">
        Hämtar detaljer…
      </div>
    );
  }

  return (
    <div className="bg-muted/20 border-t border-border px-6 py-4 space-y-3">
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-muted-foreground font-medium">Beräkningsmetod</span>
          <p className="font-mono mt-0.5">{data?.calculationMethod ?? "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground font-medium">Mappningskälla</span>
          <p className="font-mono mt-0.5">{data?.mappingSource ?? "—"}</p>
        </div>
        {data?.linkedAccountIds && (
          <div>
            <span className="text-muted-foreground font-medium">Kontogrupper</span>
            <p className="font-mono mt-0.5 text-[11px]">{data.linkedAccountIds}</p>
          </div>
        )}
        {data?.suggestedNoteType && (
          <div>
            <span className="text-muted-foreground font-medium">Föreslagen nottyp</span>
            <p className="font-mono mt-0.5">{data.suggestedNoteType}</p>
            {data.noteReferenceStatus && (
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                Status: {data.noteReferenceStatus}
              </p>
            )}
          </div>
        )}
        {data?.isManuallyAdjusted && data.manualAdjustmentOriginal !== null && (
          <div className="col-span-2 rounded bg-amber-500/10 px-2 py-2">
            <span className="text-amber-700 font-medium text-[11px]">Manuellt justerat</span>
            <p className="text-[11px] mt-0.5">
              Originalvärde: <span className="font-mono">{formatAmount(data.manualAdjustmentOriginal as string | undefined)}</span>
            </p>
            {data.manualAdjustmentReason && (
              <p className="text-[11px] text-amber-700/80 mt-0.5">Orsak: {data.manualAdjustmentReason}</p>
            )}
          </div>
        )}
        {data?.noteReferenceReason && (
          <div className="col-span-2">
            <span className="text-muted-foreground font-medium">Notförslag</span>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{data.noteReferenceReason}</p>
          </div>
        )}
      </div>

      {data?.sourceAccounts && data.sourceAccounts.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Kontogrupper (SIE-saldon tillgängliga efter import)</p>
          <div className="rounded border border-border overflow-hidden text-xs">
            <div className="grid grid-cols-3 bg-muted/40 px-3 py-1.5 font-medium text-muted-foreground">
              <span>Kontogrupp</span>
              <span>Benämning</span>
              <span className="text-right">Saldo</span>
            </div>
            {data.sourceAccounts.map((acct) => (
              <div key={acct.accountNumber} className="grid grid-cols-3 px-3 py-1.5 border-t border-border">
                <span className="font-mono text-[11px]">{acct.accountNumber}</span>
                <span className="text-muted-foreground">{acct.accountName ?? "—"}</span>
                <span className="text-right font-mono text-muted-foreground/50 italic">
                  {acct.balance !== null ? formatAmount(acct.balance) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Inga kontogrupper kopplade (beräknad rad).
        </p>
      )}
    </div>
  );
}

// ─── Previous Year Cell ───────────────────────────────────────────────────────

function PreviousYearCell({
  line,
  reportId,
  onUpdated,
}: {
  line: FinancialStatementLine;
  reportId: string;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const savePrevYear = useSavePreviousYearValues();
  const { toast } = useToast();

  if (line.isHeading) return null;

  const hasPrevYear = line.previousYearAmount !== null && line.previousYearAmount !== undefined;

  const handleSave = () => {
    const trimmed = draft.replace(/\s/g, "");
    if (!trimmed) { setEditing(false); return; }
    const parsed = parseFloat(trimmed.replace(",", "."));
    if (isNaN(parsed)) {
      toast({ title: "Ogiltigt belopp", description: "Ange ett numeriskt värde.", variant: "destructive" });
      return;
    }
    savePrevYear.mutate(
      { reportId, data: { values: [{ lineId: line.id, amount: String(parsed), source: "manual" }] } },
      {
        onSuccess: () => { setEditing(false); setDraft(""); onUpdated(); },
        onError: () => toast({ title: "Fel", description: "Kunde inte spara jämförelseårsvärde.", variant: "destructive" }),
      },
    );
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-6 w-24 text-xs font-mono text-right"
          placeholder="0"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setEditing(false); setDraft(""); }
          }}
          onBlur={handleSave}
        />
      </div>
    );
  }

  if (hasPrevYear) {
    return (
      <div
        className="flex items-center gap-1 cursor-pointer group/py"
        title="Klicka för att redigera jämförelseårsvärde"
        onClick={(e) => {
          e.stopPropagation();
          setDraft(String(line.previousYearAmount));
          setEditing(true);
        }}
      >
        <span className={cn(
          "font-mono text-sm tabular-nums",
          line.isTotal && "font-bold text-base",
          line.isSubtotal && "font-semibold",
        )}>
          {formatAmount(line.previousYearAmount)}
        </span>
        <Pencil className="h-2.5 w-2.5 text-muted-foreground/30 opacity-0 group-hover/py:opacity-100 transition-opacity" />
        {line.previousYearSource === "manual" && (
          <span className="text-[9px] text-muted-foreground/50 hidden group-hover/py:inline">manuell</span>
        )}
      </div>
    );
  }

  if (line.isTotal || line.isSubtotal) {
    return <span className="text-muted-foreground/30 font-mono text-xs">—</span>;
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setDraft("");
        setEditing(true);
      }}
      className="text-[11px] text-muted-foreground/30 hover:text-muted-foreground/70 italic transition-colors font-mono"
      title="Ange jämförelseårsvärde"
    >
      Ange…
    </button>
  );
}

// ─── Manual Adjustment Cell ───────────────────────────────────────────────────

function ManualAdjustmentCell({
  line,
  reportId,
  onUpdated,
}: {
  line: FinancialStatementLine;
  reportId: string;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(line.currentYearAmount ?? ""));
  const [reason, setReason] = useState("");
  const update = useUpdateStatementLine();
  const { toast } = useToast();

  if (line.isHeading || line.calculationMethod === "derived" || line.isTotal || line.isSubtotal) {
    return null;
  }

  const handleSave = () => {
    const parsed = parseFloat(amount.replace(/\s/g, "").replace(",", "."));
    if (isNaN(parsed)) {
      toast({ title: "Ogiltigt belopp", variant: "destructive" });
      return;
    }
    update.mutate(
      {
        reportId,
        lineId: line.id,
        data: { manualAdjustmentAmount: String(parsed), manualAdjustmentReason: reason || null },
      },
      {
        onSuccess: () => {
          setOpen(false);
          onUpdated();
          toast({ title: "Justering sparad" });
        },
        onError: () => toast({ title: "Fel", description: "Kunde inte spara justering.", variant: "destructive" }),
      },
    );
  };

  const handleRevert = () => {
    if (!line.manualAdjustmentOriginal) return;
    update.mutate(
      {
        reportId,
        lineId: line.id,
        data: { manualAdjustmentAmount: line.manualAdjustmentOriginal, manualAdjustmentReason: "Återställt till importerat värde" },
      },
      {
        onSuccess: () => {
          setOpen(false);
          onUpdated();
          toast({ title: "Återställt" });
        },
      },
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-muted",
            line.isManuallyAdjusted && "opacity-100 text-amber-500",
          )}
          title={line.isManuallyAdjusted ? "Redigera manuell justering" : "Justera belopp manuellt"}
          onClick={(e) => e.stopPropagation()}
        >
          <Pencil className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Pencil className="h-3 w-3" />
              Manuell justering
            </div>
            {line.isManuallyAdjusted && line.manualAdjustmentOriginal && (
              <button
                onClick={handleRevert}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Återställ
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">{line.swedishLabel}</p>
          {line.isManuallyAdjusted && line.manualAdjustmentOriginal && (
            <div className="text-[11px] text-muted-foreground">
              Originalt: <span className="font-mono">{formatAmount(line.manualAdjustmentOriginal)}</span>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Nytt belopp (SEK)</label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="h-7 text-xs font-mono text-right"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setOpen(false); }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Orsak (valfritt)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Förklaring till justeringen…"
              className="min-h-[56px] text-xs resize-none"
              rows={2}
            />
          </div>
          <div className="flex gap-1 pt-1">
            <Button size="sm" className="h-6 text-xs flex-1" onClick={handleSave} disabled={update.isPending}>
              Spara justering
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main Table ───────────────────────────────────────────────────────────────

export function StatementTable({ lines, reportId, statementType, onLineUpdated }: StatementTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const hasManualAdjustments = lines.some((l) => l.isManuallyAdjusted);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
        <FileText className="h-8 w-8 opacity-30" />
        <p className="text-sm">Inga rader genererade ännu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hasManualAdjustments && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Manuella justeringar aktiva.</span>{" "}
            En eller flera rader avviker från beräknade värden.
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_72px_140px_140px] bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border">
          <span>Benämning</span>
          <span className="text-center">Not</span>
          <span className="text-right">Innevarande år</span>
          <span className="text-right">Föregående år</span>
        </div>

        {lines.map((line) => {
          const isExp = expanded.has(line.id);
          const canExpand = !line.isHeading;

          return (
            <div key={line.id} className="border-b border-border last:border-0">
              <div
                className={cn(
                  "grid grid-cols-[1fr_72px_140px_140px] px-4 py-2 items-center gap-2 transition-colors group",
                  line.isTotal && "bg-muted/30 font-bold border-t-2 border-border",
                  line.isSubtotal && "bg-muted/10 font-semibold",
                  line.isHeading && "pt-4 pb-1",
                  canExpand && "hover:bg-muted/10 cursor-pointer",
                  line.isManuallyAdjusted && "bg-amber-500/5",
                )}
                onClick={() => canExpand && toggle(line.id)}
              >
                {/* Label */}
                <div className="flex items-center gap-1.5 min-w-0">
                  {canExpand ? (
                    <span className="shrink-0 text-muted-foreground/40">
                      {isExp
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                    </span>
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  <span
                    className={cn(
                      "truncate text-sm",
                      line.isHeading && "text-xs font-semibold text-muted-foreground uppercase tracking-wide",
                    )}
                  >
                    {line.swedishLabel}
                  </span>
                  {line.isManuallyAdjusted && (
                    <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                  )}
                </div>

                {/* Note ref */}
                <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                  {!line.isHeading && !line.isTotal && !line.isSubtotal && (
                    <NoteReferenceCell line={line} reportId={reportId} onUpdated={() => onLineUpdated?.()} />
                  )}
                </div>

                {/* Current year — render the *presented* amount so approved
                    reclassifications are reflected here, in the export, and in
                    reconciliation. Falls back to mappad amount when no
                    reclassification touches the line. */}
                <div className="text-right flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  {!line.isHeading && (
                    <>
                      <ManualAdjustmentCell line={line} reportId={reportId} onUpdated={() => onLineUpdated?.()} />
                      <PresentedAmountCell line={line} />
                    </>
                  )}
                </div>

                {/* Previous year */}
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <PreviousYearCell
                    line={line}
                    reportId={reportId}
                    onUpdated={() => onLineUpdated?.()}
                  />
                </div>
              </div>

              {isExp && <DrilldownPanel line={line} reportId={reportId} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
