import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  type Note,
  useUpdateReportNote,
  useAcceptNoteText,
  useRequestNoteAiDraft,
  getListReportNotesQueryKey,
  getGetFinancialStatementsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
  Calculator,
  MessageCircle,
  Save,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NoteDetailDrawerProps {
  note: Note | null;
  reportId: string;
  open: boolean;
  onClose: () => void;
}

function formatSek(value: string | null | undefined): string {
  if (!value) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n);
}

function diffPercent(curr: string | null | undefined, prev: string | null | undefined): string | null {
  if (!curr || !prev) return null;
  const c = Number(curr);
  const p = Number(prev);
  if (Number.isNaN(c) || Number.isNaN(p) || p === 0) return null;
  const pct = ((c - p) / Math.abs(p)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function NoteDetailDrawer({ note, reportId, open, onClose }: NoteDetailDrawerProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const updateNote = useUpdateReportNote();
  const acceptText = useAcceptNoteText();
  const aiDraft = useRequestNoteAiDraft();

  const [draft, setDraft] = useState("");
  const [aiInfo, setAiInfo] = useState<string | null>(null);

  useEffect(() => {
    setDraft(note?.acceptedText ?? note?.suggestedText ?? "");
    setAiInfo(null);
  }, [note?.id, note?.acceptedText, note?.suggestedText]);

  if (!note) return null;

  const linkedLines = Array.isArray(note.linkedStatementLines)
    ? (note.linkedStatementLines as Array<{ lineKey: string; statementType: string; label: string }>)
    : [];

  const isAi = note.textIsAiGenerated && !!note.acceptedText;
  const hasAcceptedText = !!note.acceptedText && note.acceptedText.length > 0;
  const missingValues =
    note.requirementLevel === "required" &&
    !note.currentYearValue &&
    !note.previousYearValue;
  const diff = diffPercent(note.currentYearValue, note.previousYearValue);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListReportNotesQueryKey(reportId) });
    qc.invalidateQueries({ queryKey: getGetFinancialStatementsQueryKey(reportId) });
  };

  const handleSaveDraft = () => {
    updateNote.mutate(
      { reportId, noteId: note.id, data: { suggestedText: draft } },
      {
        onSuccess: () => {
          toast({ title: "Utkast sparat", description: "Texten finns nu som förslag." });
          invalidate();
        },
        onError: (e) => {
          toast({ title: "Misslyckades att spara", description: String(e), variant: "destructive" });
        },
      },
    );
  };

  const handleAccept = () => {
    acceptText.mutate(
      { reportId, noteId: note.id, data: { text: draft || null } },
      {
        onSuccess: () => {
          toast({
            title: "Text godkänd",
            description: "Noten har granskats och texten är fastställd.",
          });
          invalidate();
        },
        onError: (e) => {
          toast({ title: "Kunde inte godkänna", description: String(e), variant: "destructive" });
        },
      },
    );
  };

  const handleAiDraft = () => {
    setAiInfo(null);
    aiDraft.mutate(
      { reportId, noteId: note.id },
      {
        onSuccess: (resp) => {
          if (resp.provider === "not_configured") {
            setAiInfo(resp.instructions ?? "AI-tjänst inte konfigurerad.");
            return;
          }
          if (resp.draft) {
            setDraft(resp.draft);
            toast({
              title: "AI-utkast skapat",
              description: "Granska noggrant innan du godkänner.",
            });
            invalidate();
          }
        },
        onError: (e) => {
          toast({ title: "AI-utkast misslyckades", description: String(e), variant: "destructive" });
        },
      },
    );
  };

  const handleStatusChange = (status: Note["status"]) => {
    updateNote.mutate(
      { reportId, noteId: note.id, data: { status } },
      {
        onSuccess: () => {
          toast({ title: "Status uppdaterad" });
          invalidate();
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" data-testid="note-detail-drawer">
        <SheetHeader className="space-y-3 pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            {note.noteNumber !== null && (
              <Badge variant="outline" className="font-mono">Not {note.noteNumber}</Badge>
            )}
            <Badge variant="outline" className="text-[10px] uppercase">{note.framework}</Badge>
            {note.requirementLevel === "required" && (
              <Badge variant="outline" className="bg-red-500/10 text-red-700 border-transparent text-[10px]">
                Krävs
              </Badge>
            )}
            {isAi && (
              <Badge variant="outline" className="bg-violet-500/10 text-violet-700 border-transparent text-[10px] gap-1">
                <Sparkles className="h-2.5 w-2.5" /> AI-utkast
              </Badge>
            )}
          </div>
          <SheetTitle className="text-2xl">{note.title}</SheetTitle>
          {note.sourceTrigger && (
            <SheetDescription>{note.sourceTrigger}</SheetDescription>
          )}
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Values */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Innevarande år</div>
              <div className="font-mono text-lg mt-1">{formatSek(note.currentYearValue)} kr</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Föregående år</div>
              <div className="font-mono text-lg mt-1">{formatSek(note.previousYearValue)} kr</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Förändring</div>
              <div className="font-mono text-lg mt-1">{diff ?? "—"}</div>
            </div>
          </div>

          {missingValues && (
            <Alert variant="destructive" className="border-red-500/30 bg-red-500/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Värden saknas</AlertTitle>
              <AlertDescription>
                Denna not är obligatorisk men har inga belopp. Fyll i räkenskapsdata
                i finansiella rapporter eller ange manuella värden.
              </AlertDescription>
            </Alert>
          )}

          {/* Linked lines */}
          {linkedLines.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Kopplade rader</h4>
              <div className="rounded-lg border border-border divide-y">
                {linkedLines.map((l, i) => (
                  <div key={i} className="px-3 py-2 flex items-center justify-between text-sm">
                    <span>{l.label}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">{l.lineKey}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Text editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Förslag / Godkänd text</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAiDraft}
                disabled={aiDraft.isPending}
                data-testid="button-ai-draft"
              >
                {aiDraft.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                Begär AI-utkast
              </Button>
            </div>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Skriv eller generera notens text på svenska…"
              rows={8}
              className="font-serif"
              data-testid="textarea-note-text"
            />
            {aiInfo && (
              <Alert className="mt-2 border-amber-500/30 bg-amber-500/5">
                <Info className="h-4 w-4" />
                <AlertDescription>{aiInfo}</AlertDescription>
              </Alert>
            )}
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={updateNote.isPending}
              >
                <Save className="h-3 w-3 mr-1" />
                Spara utkast
              </Button>
              <Button
                size="sm"
                onClick={handleAccept}
                disabled={acceptText.isPending || !draft.trim()}
                data-testid="button-accept-text"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Godkänn text
              </Button>
              {hasAcceptedText && (
                <span className="text-xs text-muted-foreground ml-auto">
                  Senast godkänd:{" "}
                  {note.acceptedAt
                    ? new Date(note.acceptedAt).toLocaleDateString("sv-SE")
                    : "—"}
                </span>
              )}
            </div>
          </div>

          {/* Status quick set */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Status</h4>
            <div className="flex flex-wrap gap-2">
              {(["needs_review", "reviewed", "complete", "missing_info"] as const).map((s) => (
                <Button
                  key={s}
                  variant={note.status === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusChange(s)}
                >
                  {s === "needs_review" && "Behöver granskas"}
                  {s === "reviewed" && "Granskad"}
                  {s === "complete" && "Klar"}
                  {s === "missing_info" && "Saknar info"}
                </Button>
              ))}
            </div>
          </div>

          <Accordion type="multiple" className="w-full">
            <AccordionItem value="why">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Info className="h-4 w-4" /> Varför krävs denna not?
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground">
                  {note.sourceTrigger ?? "Ingen specifik regel registrerad."}
                  {" "}Ramverket ({note.framework}) reglerar tilläggsupplysningar enligt ÅRL
                  och K-regelverket. Granska aktuella regler från Bokföringsnämnden.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="calc">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" /> Visa underlag / beräkning
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <div>Notnummer: <span className="font-mono">{note.noteNumber ?? "—"}</span></div>
                  <div>Typ: <span className="font-mono">{note.noteType}</span></div>
                  <div>Sortering: <span className="font-mono">{note.sortOrder}</span></div>
                  <div>Manuell ordningsövergång: <span className="font-mono">{note.manualNumberOverride ?? "—"}</span></div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="comments">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" /> Kommentarer
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground italic">
                  Kommentarer (kommer i fas 6).
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  );
}
