import { useEffect, useMemo, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useListReportNotes,
  useSuggestReportNotes,
  useRecalculateNoteNumbers,
  useUpdateReportNote,
  useCreateReportNote,
  useGetReport,
  useGetNotesReconciliation,
  getGetReportQueryKey,
  getListReportNotesQueryKey,
  getGetFinancialStatementsQueryKey,
  getGetNotesReconciliationQueryKey,
  type Note,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  FileText,
  Sparkles,
  RefreshCw,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Plus,
  CheckCircle2,
  AlertTriangle,
  CircleDashed,
  Link2Off,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NoteCard } from "@/components/NoteCard";
import { NoteDetailDrawer } from "@/components/NoteDetailDrawer";

const NOTE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "accounting_principles", label: "Redovisningsprinciper" },
  { value: "revenue", label: "Intäkter" },
  { value: "personnel", label: "Personal" },
  { value: "depreciation", label: "Avskrivningar" },
  { value: "intangible_assets", label: "Immateriella anläggningstillgångar" },
  { value: "tangible_assets", label: "Materiella anläggningstillgångar" },
  { value: "financial_assets", label: "Finansiella anläggningstillgångar" },
  { value: "equity", label: "Eget kapital" },
  { value: "appropriations", label: "Bokslutsdispositioner" },
  { value: "long_term_liabilities", label: "Långfristiga skulder" },
  { value: "other", label: "Övrig not" },
];

export function NotesPage() {
  const [, params] = useRoute("/reports/:reportId/notes");
  const reportId = params?.reportId ?? "";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newType, setNewType] = useState("other");
  const [newTitle, setNewTitle] = useState("");
  const [newRequirement, setNewRequirement] =
    useState<"required" | "likely_required" | "optional">("optional");

  const { data: report } = useGetReport(reportId, {
    query: { enabled: !!reportId, queryKey: getGetReportQueryKey(reportId) },
  });
  const { data, isLoading } = useListReportNotes(reportId, {
    query: { enabled: !!reportId, queryKey: getListReportNotesQueryKey(reportId) },
  });
  const { data: reconciliation } = useGetNotesReconciliation(reportId, {
    query: {
      enabled: !!reportId,
      queryKey: getGetNotesReconciliationQueryKey(reportId),
    },
  });

  const suggest = useSuggestReportNotes();
  const recalc = useRecalculateNoteNumbers();
  const updateNote = useUpdateReportNote();
  const createNote = useCreateReportNote();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListReportNotesQueryKey(reportId) });
    qc.invalidateQueries({ queryKey: getGetFinancialStatementsQueryKey(reportId) });
    qc.invalidateQueries({ queryKey: getGetNotesReconciliationQueryKey(reportId) });
  };

  // Honour ?open=<noteId> for deep-linking from statement-table badges.
  const openNoteId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    return sp.get("open");
  }, []);
  useEffect(() => {
    if (!openNoteId || !data?.notes) return;
    const found = data.notes.find((n) => n.id === openNoteId);
    if (found) setActiveNote(found);
  }, [openNoteId, data?.notes]);

  // Keep the active drawer in sync with the latest data so confirm/accept
  // updates reflect immediately.
  useEffect(() => {
    if (!activeNote || !data?.notes) return;
    const fresh = data.notes.find((n) => n.id === activeNote.id);
    if (fresh && fresh !== activeNote) setActiveNote(fresh);
  }, [data?.notes, activeNote]);

  const handleCreateNote = () => {
    if (!newTitle.trim()) {
      toast({ title: "Titel krävs", variant: "destructive" });
      return;
    }
    createNote.mutate(
      {
        reportId,
        data: {
          noteType: newType,
          title: newTitle.trim(),
          requirementLevel: newRequirement,
        },
      },
      {
        onSuccess: (n) => {
          toast({ title: "Not skapad", description: n.title });
          setCreateOpen(false);
          setNewTitle("");
          setNewType("other");
          setNewRequirement("optional");
          invalidate();
          setActiveNote(n);
        },
        onError: (e) =>
          toast({ title: "Kunde inte skapa not", description: String(e), variant: "destructive" }),
      },
    );
  };

  const handleSuggest = () => {
    suggest.mutate(
      { reportId },
      {
        onSuccess: (r) => {
          toast({
            title: "Förslag uppdaterade",
            description: `${r.created} skapade, ${r.updated} uppdaterade.`,
          });
          invalidate();
        },
        onError: (e) =>
          toast({ title: "Förslag misslyckades", description: String(e), variant: "destructive" }),
      },
    );
  };

  const handleRecalc = () => {
    recalc.mutate(
      { reportId },
      {
        onSuccess: (r) => {
          toast({
            title: "Notnummer uppdaterade",
            description: `${r.renumbered} av ${r.total} noter omnumrerade.`,
          });
          invalidate();
        },
      },
    );
  };

  const handleToggleNA = (note: Note, makeNA: boolean) => {
    updateNote.mutate(
      {
        reportId,
        noteId: note.id,
        data: { status: makeNA ? "not_applicable" : "suggested" },
      },
      {
        onSuccess: () => {
          toast({
            title: makeNA ? "Markerad som ej tillämplig" : "Återaktiverad",
          });
          invalidate();
        },
      },
    );
  };

  if (!reportId) return null;

  const notes = data?.notes ?? [];
  const activeNotes = notes.filter((n) => n.status !== "not_applicable");
  const naNotes = notes.filter((n) => n.status === "not_applicable");
  const requiredMissing = activeNotes.filter(
    (n) =>
      n.requirementLevel === "required" &&
      (!n.acceptedText || n.acceptedText.length === 0),
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href={`/reports/${reportId}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Tillbaka till rapporten
        </Link>
        {report && (
          <Badge variant="outline" className="font-mono">{report.accountingFramework}</Badge>
        )}
      </div>

      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Noter
          </h1>
          <p className="text-muted-foreground mt-1">
            Tilläggsupplysningar enligt {report?.accountingFramework ?? "ramverket"}.
            Numreras automatiskt och synkar mot rapporten.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/reports/${reportId}/statements`)}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Finansiella rapporter
          </Button>
          <Button
            variant="outline"
            onClick={handleRecalc}
            disabled={recalc.isPending || notes.length === 0}
            data-testid="button-recalculate"
          >
            {recalc.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Omnumrera
          </Button>
          <Button
            variant="outline"
            onClick={() => setCreateOpen(true)}
            data-testid="button-new-note"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ny not
          </Button>
          <Button
            onClick={handleSuggest}
            disabled={suggest.isPending}
            data-testid="button-suggest"
          >
            {suggest.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generera förslag
          </Button>
        </div>
      </div>

      {/* Compliance banner */}
      <Alert className="border-emerald-500/30 bg-emerald-500/5">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <AlertTitle>Compliance-assistent</AlertTitle>
        <AlertDescription>
          Inga blockerande valideringsfel hittades. Granska noggrant innan
          inlämning. Verktyget är en complianceassistent — du som upprättare
          ansvarar för noternas korrekthet enligt ÅRL och K-regelverket.
        </AlertDescription>
      </Alert>

      {requiredMissing.length > 0 && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <AlertTitle>{requiredMissing.length} obligatorisk(a) noter saknar text</AlertTitle>
          <AlertDescription>
            Skriv eller generera ett förslag och godkänn texten innan rapporten
            kan markeras som klar.
          </AlertDescription>
        </Alert>
      )}

      {/* Reconciliation summary */}
      {reconciliation && reconciliation.items.length > 0 && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Avstämning mot rapporten</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="rounded border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                <div className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="font-medium">Stämmer</span>
                </div>
                <div className="font-mono text-lg mt-0.5">{reconciliation.okCount}</div>
              </div>
              <div className="rounded border border-red-500/30 bg-red-500/5 px-3 py-2">
                <div className="flex items-center gap-1 text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="font-medium">Differens</span>
                </div>
                <div className="font-mono text-lg mt-0.5">{reconciliation.mismatchCount}</div>
              </div>
              <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <div className="flex items-center gap-1 text-amber-700">
                  <Link2Off className="h-3 w-3" />
                  <span className="font-medium">Saknar koppling</span>
                </div>
                <div className="font-mono text-lg mt-0.5">{reconciliation.missingLinkCount}</div>
              </div>
              <div className="rounded border border-muted px-3 py-2">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <CircleDashed className="h-3 w-3" />
                  <span className="font-medium">Inga belopp</span>
                </div>
                <div className="font-mono text-lg mt-0.5">{reconciliation.noAmountsCount}</div>
              </div>
            </div>
            {reconciliation.mismatchCount > 0 && (
              <div className="rounded border border-red-500/30 bg-red-500/5 divide-y text-xs">
                {reconciliation.items
                  .filter((i) => i.status === "mismatch")
                  .slice(0, 5)
                  .map((i) => (
                    <button
                      key={i.noteId}
                      onClick={() => {
                        const n = data?.notes.find((x) => x.id === i.noteId);
                        if (n) setActiveNote(n);
                      }}
                      className="block w-full text-left px-3 py-2 hover:bg-red-500/10"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">
                          {i.noteNumber !== null ? `Not ${i.noteNumber} — ` : ""}
                          {i.title}
                        </span>
                        <span className="font-mono text-red-700 shrink-0">
                          Δ {i.differenceCurrent
                            ? Number(i.differenceCurrent).toLocaleString("sv-SE")
                            : "—"} kr
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : notes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <h3 className="font-semibold text-lg">Inga noter ännu</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Klicka på "Generera förslag" för att skapa noter automatiskt baserat på
              dina räkenskapsuppgifter och valt ramverk.
            </p>
            <Button onClick={handleSuggest} disabled={suggest.isPending}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generera förslag
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{activeNotes.length} aktiva noter</span>
              {naNotes.length > 0 && <span>{naNotes.length} ej tillämpliga</span>}
            </div>
            {activeNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => setActiveNote(note)}
                onToggleNotApplicable={(next) => handleToggleNA(note, next)}
              />
            ))}
          </div>

          {naNotes.length > 0 && (
            <details className="rounded-lg border border-border">
              <summary className="px-4 py-2 cursor-pointer text-sm text-muted-foreground hover:bg-muted/30">
                Visa ej tillämpliga ({naNotes.length})
              </summary>
              <div className="space-y-2 p-3">
                {naNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onClick={() => setActiveNote(note)}
                    onToggleNotApplicable={(next) => handleToggleNA(note, next)}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}

      <NoteDetailDrawer
        reportId={reportId}
        note={activeNote}
        open={!!activeNote}
        onClose={() => setActiveNote(null)}
      />

      {/* Create-note dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ny not</DialogTitle>
            <DialogDescription>
              Lägg till en manuell not. Du kan ange beloppsrader och text efter
              att noten skapats.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nottyp</label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Titel</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="t.ex. Materiella anläggningstillgångar"
                className="mt-1"
                data-testid="input-new-note-title"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Krav</label>
              <Select
                value={newRequirement}
                onValueChange={(v) =>
                  setNewRequirement(v as "required" | "likely_required" | "optional")
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">Obligatorisk</SelectItem>
                  <SelectItem value="likely_required">Sannolikt obligatorisk</SelectItem>
                  <SelectItem value="optional">Frivillig</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Avbryt
            </Button>
            <Button
              onClick={handleCreateNote}
              disabled={createNote.isPending}
              data-testid="button-create-note"
            >
              {createNote.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Skapa not
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
