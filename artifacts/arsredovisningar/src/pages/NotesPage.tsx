import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useListReportNotes,
  useSuggestReportNotes,
  useRecalculateNoteNumbers,
  useUpdateReportNote,
  useGetReport,
  getGetReportQueryKey,
  getListReportNotesQueryKey,
  getGetFinancialStatementsQueryKey,
  type Note,
} from "@workspace/api-client-react";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NoteCard } from "@/components/NoteCard";
import { NoteDetailDrawer } from "@/components/NoteDetailDrawer";

export function NotesPage() {
  const [, params] = useRoute("/reports/:reportId/notes");
  const reportId = params?.reportId ?? "";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeNote, setActiveNote] = useState<Note | null>(null);

  const { data: report } = useGetReport(reportId, {
    query: { enabled: !!reportId, queryKey: getGetReportQueryKey(reportId) },
  });
  const { data, isLoading } = useListReportNotes(reportId, {
    query: { enabled: !!reportId, queryKey: getListReportNotesQueryKey(reportId) },
  });

  const suggest = useSuggestReportNotes();
  const recalc = useRecalculateNoteNumbers();
  const updateNote = useUpdateReportNote();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListReportNotesQueryKey(reportId) });
    qc.invalidateQueries({ queryKey: getGetFinancialStatementsQueryKey(reportId) });
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
          Inga blockerande valideringsfel hittades. Granska noggrant innan inlämning —
          du som upprättare ansvarar för noternas korrekthet enligt ÅRL och K-regelverket.
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
    </div>
  );
}
