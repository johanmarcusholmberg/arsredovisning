import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronRight, AlertTriangle, FileText, BookOpen } from "lucide-react";
import {
  useGetStatementLineDrilldown,
  getGetStatementLineDrilldownQueryKey,
  useUpdateStatementLine,
} from "@workspace/api-client-react";
import type { FinancialStatementLine } from "@workspace/api-client-react";

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

  const handleSave = () => {
    update.mutate(
      { reportId, lineId: line.id, data: { noteReferenceText: draft || null } },
      { onSuccess: () => { setOpen(false); onUpdated(); } },
    );
  };

  const hasRef = !!line.noteReferenceText;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-6 min-w-[2rem] px-1.5 rounded text-xs font-mono transition-colors border",
            hasRef
              ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
              : "bg-transparent text-muted-foreground/40 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 hover:text-muted-foreground/60",
          )}
        >
          {hasRef ? `Not ${line.noteReferenceText}` : "—"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="center">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
            <BookOpen className="h-3 w-3" />
            Notreferens
          </div>
          <p className="text-xs text-muted-foreground">{line.swedishLabel}</p>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="t.ex. 3 eller 3, 4"
            className="h-7 text-xs font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <div className="flex gap-1 pt-1">
            <Button size="sm" className="h-6 text-xs flex-1" onClick={handleSave} disabled={update.isPending}>
              Spara
            </Button>
            {hasRef && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
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
        {data?.suggestedNoteType && (
          <div>
            <span className="text-muted-foreground font-medium">Föreslagen nottyp</span>
            <p className="font-mono mt-0.5">{data.suggestedNoteType}</p>
          </div>
        )}
        {data?.noteReferenceReason && (
          <div className="col-span-2">
            <span className="text-muted-foreground font-medium">Orsak till notförslag</span>
            <p className="mt-0.5 text-xs">{data.noteReferenceReason}</p>
          </div>
        )}
      </div>
      {data?.sourceAccounts && data.sourceAccounts.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Källkonton</p>
          <div className="rounded border border-border overflow-hidden text-xs">
            <div className="grid grid-cols-3 bg-muted/40 px-3 py-1.5 font-medium text-muted-foreground">
              <span>Kontonr</span>
              <span>Namn</span>
              <span className="text-right">Saldo</span>
            </div>
            {data.sourceAccounts.map((acct) => (
              <div key={acct.accountNumber} className="grid grid-cols-3 px-3 py-1.5 border-t border-border">
                <span className="font-mono">{acct.accountNumber}</span>
                <span className="text-muted-foreground">{acct.accountName ?? "—"}</span>
                <span className="text-right font-mono">{formatAmount(acct.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Inga källkonton kopplade — importera SIE-fil för att se kontodetaljer.
        </p>
      )}
    </div>
  );
}

function PreviousYearCell({
  line,
  reportId,
  onUpdated,
}: {
  line: FinancialStatementLine;
  reportId: string;
  onUpdated: () => void;
}) {
  const update = useUpdateStatementLine();

  if (line.isHeading || line.isTotal || line.isSubtotal) {
    return (
      <span className="text-muted-foreground/50 text-xs font-mono tabular-nums">
        {formatAmount(line.previousYearAmount)}
      </span>
    );
  }

  if (line.previousYearAmount !== null && line.previousYearAmount !== undefined) {
    return (
      <div className="text-right">
        <span className="font-mono text-sm tabular-nums">{formatAmount(line.previousYearAmount)}</span>
        {line.previousYearSource && (
          <p className="text-[10px] text-muted-foreground/60 leading-tight">
            {line.previousYearSource === "imported" ? "Importerad"
              : line.previousYearSource === "manual" ? "Manuell"
              : "Jämförelseår"}
          </p>
        )}
      </div>
    );
  }

  return (
    <span className="text-xs text-muted-foreground/30 italic font-mono">—</span>
  );
}

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
            En eller flera rader har överskrivits manuellt.
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_130px_130px] bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border">
          <span>Benämning</span>
          <span className="text-center">Not</span>
          <span className="text-right">Innevarande år</span>
          <span className="text-right">Föregående år</span>
        </div>

        {lines.map((line) => {
          const isExp = expanded.has(line.id);
          const canExpand = !line.isHeading && !line.isSubtotal && !line.isTotal;

          return (
            <div key={line.id} className="border-b border-border last:border-0">
              <div
                className={cn(
                  "grid grid-cols-[1fr_80px_130px_130px] px-4 py-2 items-center gap-2 transition-colors",
                  line.isTotal && "bg-muted/30 font-bold border-t-2 border-border",
                  line.isSubtotal && "bg-muted/10 font-semibold",
                  line.isHeading && "bg-transparent pt-4 pb-1",
                  canExpand && "hover:bg-muted/10 cursor-pointer",
                  line.isManuallyAdjusted && "bg-amber-500/5",
                )}
                onClick={() => canExpand && toggle(line.id)}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {canExpand ? (
                    <span className="shrink-0 text-muted-foreground/40">
                      {isExp ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
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
                  {line.isManuallyAdjusted && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                </div>

                <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                  {!line.isHeading && !line.isTotal && !line.isSubtotal && (
                    <NoteReferenceCell line={line} reportId={reportId} onUpdated={() => onLineUpdated?.()} />
                  )}
                </div>

                <div className="text-right">
                  {!line.isHeading && (
                    <span className={cn("font-mono text-sm tabular-nums", line.isTotal && "text-base font-bold", line.isSubtotal && "font-semibold")}>
                      {formatAmount(line.currentYearAmount)}
                    </span>
                  )}
                </div>

                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  {!line.isHeading && (
                    <PreviousYearCell line={line} reportId={reportId} onUpdated={() => onLineUpdated?.()} />
                  )}
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
