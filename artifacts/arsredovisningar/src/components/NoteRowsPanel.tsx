import { useState } from "react";
import {
  useListNoteRows,
  useCreateNoteRow,
  useUpdateNoteRow,
  useDeleteNoteRow,
  getListNoteRowsQueryKey,
  getGetNotesReconciliationQueryKey,
  getListReportNotesQueryKey,
  type NoteRow,
  type NoteRowDrilldownAccount,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Save,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatSek(value: string | null | undefined): string {
  if (!value) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n);
}

interface RowEditorProps {
  reportId: string;
  noteId: string;
  row: NoteRow;
  drilldown: NoteRowDrilldownAccount[];
  onChanged: () => void;
}

function RowEditor({ reportId, noteId, row, drilldown, onChanged }: RowEditorProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [label, setLabel] = useState(row.label);
  const [cur, setCur] = useState(row.currentYearAmount ?? "");
  const [prev, setPrev] = useState(row.previousYearAmount ?? "");
  const [isSubtotal, setIsSubtotal] = useState(row.isSubtotal);

  const update = useUpdateNoteRow();
  const del = useDeleteNoteRow();

  const dirty =
    label !== row.label ||
    (cur || "") !== (row.currentYearAmount ?? "") ||
    (prev || "") !== (row.previousYearAmount ?? "") ||
    isSubtotal !== row.isSubtotal;

  const handleSave = () => {
    update.mutate(
      {
        reportId,
        noteId,
        rowId: row.id,
        data: {
          label,
          currentYearAmount: cur === "" ? null : cur,
          previousYearAmount: prev === "" ? null : prev,
          isSubtotal,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Rad uppdaterad" });
          onChanged();
        },
        onError: (e) =>
          toast({ title: "Kunde inte uppdatera", description: String(e), variant: "destructive" }),
      },
    );
  };

  const handleDelete = () => {
    del.mutate(
      { reportId, noteId, rowId: row.id },
      {
        onSuccess: () => {
          toast({ title: "Rad borttagen" });
          onChanged();
        },
        onError: (e) =>
          toast({ title: "Kunde inte ta bort", description: String(e), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="border border-border rounded-md">
      <div className="grid grid-cols-[auto,1fr,8rem,8rem,auto] gap-2 items-center px-2 py-1.5">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={expanded ? "Dölj källor" : "Visa källor"}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-7 text-sm"
          placeholder="Etikett"
        />
        <Input
          value={cur}
          onChange={(e) => setCur(e.target.value)}
          className="h-7 text-xs font-mono text-right"
          placeholder="0"
        />
        <Input
          value={prev}
          onChange={(e) => setPrev(e.target.value)}
          className="h-7 text-xs font-mono text-right"
          placeholder="0"
        />
        <div className="flex items-center gap-1">
          {dirty && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={handleSave}
              disabled={update.isPending}
            >
              {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={del.isPending}
            aria-label="Ta bort rad"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="px-2 pb-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
        <label className="flex items-center gap-1">
          <Checkbox
            checked={isSubtotal}
            onCheckedChange={(v) => setIsSubtotal(!!v)}
            className="h-3 w-3"
          />
          Delsumma
        </label>
        {row.isManual && <Badge variant="outline" className="h-4 text-[9px]">Manuell</Badge>}
        {row.calculationNote && <span className="italic">{row.calculationNote}</span>}
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/20 px-3 py-2 text-xs">
          <div className="font-medium text-muted-foreground mb-1">
            Källkonton ({drilldown.length})
          </div>
          {drilldown.length === 0 ? (
            <p className="text-muted-foreground italic">
              Inga källkonton kopplade. Lägg till kontoområden för automatisk
              härledning.
            </p>
          ) : (
            <div className="rounded border border-border overflow-hidden">
              <div className="grid grid-cols-[5rem,1fr,7rem,7rem] bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground">
                <span>Konto</span>
                <span>Benämning</span>
                <span className="text-right">Innev. år</span>
                <span className="text-right">Föreg. år</span>
              </div>
              {drilldown.map((a) => (
                <div
                  key={a.accountNumber}
                  className="grid grid-cols-[5rem,1fr,7rem,7rem] px-2 py-1 border-t border-border text-[11px]"
                >
                  <span className="font-mono">{a.accountNumber}</span>
                  <span className="text-muted-foreground">{a.accountName}</span>
                  <span className="font-mono text-right">{formatSek(a.currentYearAmount)}</span>
                  <span className="font-mono text-right text-muted-foreground">{formatSek(a.previousYearAmount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface NoteRowsPanelProps {
  reportId: string;
  noteId: string;
}

export function NoteRowsPanel({ reportId, noteId }: NoteRowsPanelProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListNoteRows(reportId, noteId, {
    query: { enabled: !!reportId && !!noteId, queryKey: getListNoteRowsQueryKey(reportId, noteId) },
  });

  const create = useCreateNoteRow();

  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newCur, setNewCur] = useState("");
  const [newPrev, setNewPrev] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListNoteRowsQueryKey(reportId, noteId) });
    // Row mutations change the note total → reconciliation summary &
    // note list (current/previous-year values) must refresh too.
    qc.invalidateQueries({ queryKey: getGetNotesReconciliationQueryKey(reportId) });
    qc.invalidateQueries({ queryKey: getListReportNotesQueryKey(reportId) });
  };

  const handleCreate = () => {
    if (!newLabel.trim() || !newKey.trim()) {
      toast({ title: "Etikett och nyckel krävs", variant: "destructive" });
      return;
    }
    create.mutate(
      {
        reportId,
        noteId,
        data: {
          rowKey: newKey.trim(),
          label: newLabel.trim(),
          currentYearAmount: newCur || null,
          previousYearAmount: newPrev || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Rad tillagd" });
          setNewLabel(""); setNewKey(""); setNewCur(""); setNewPrev("");
          setShowAdd(false);
          invalidate();
        },
        onError: (e) =>
          toast({ title: "Kunde inte lägga till", description: String(e), variant: "destructive" }),
      },
    );
  };

  if (isLoading) {
    return <div className="text-xs text-muted-foreground py-2">Laddar rader…</div>;
  }

  const rows = data?.rows ?? [];
  const drilldown = data?.drilldown ?? {};

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto,1fr,8rem,8rem,auto] gap-2 px-2 text-[10px] uppercase text-muted-foreground tracking-wide">
        <span className="w-3"></span>
        <span>Etikett</span>
        <span className="text-right">Innevarande år</span>
        <span className="text-right">Föregående år</span>
        <span className="w-14"></span>
      </div>

      {rows.length === 0 && !showAdd && (
        <div className="text-xs text-muted-foreground italic py-2 px-2">
          Noten har inga rader. Lägg till en rad nedan för att specificera
          beloppen.
        </div>
      )}

      {rows.map((r) => (
        <RowEditor
          key={r.id}
          reportId={reportId}
          noteId={noteId}
          row={r}
          drilldown={drilldown[r.id] ?? []}
          onChanged={invalidate}
        />
      ))}

      {showAdd ? (
        <div className="border border-dashed border-primary/40 rounded-md p-2 space-y-2 bg-primary/5">
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Nyckel (t.ex. ingoende_anskaffningsvarde)"
              className="h-7 text-xs font-mono"
            />
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Etikett (t.ex. Ingående anskaffningsvärde)"
              className="h-7 text-sm"
            />
            <Input
              value={newCur}
              onChange={(e) => setNewCur(e.target.value)}
              placeholder="Innevarande år"
              className="h-7 text-xs font-mono"
            />
            <Input
              value={newPrev}
              onChange={(e) => setNewPrev(e.target.value)}
              placeholder="Föregående år"
              className="h-7 text-xs font-mono"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Lägg till
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              Avbryt
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAdd(true)}
          className="w-full"
          data-testid="button-add-note-row"
        >
          <Plus className="h-3 w-3 mr-1" />
          Lägg till rad
        </Button>
      )}
    </div>
  );
}
