import type { Note } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  FileEdit,
  CircleDot,
} from "lucide-react";

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  onToggleNotApplicable: (next: boolean) => void;
}

const REQUIREMENT_BADGE: Record<string, { label: string; className: string }> = {
  required: {
    label: "Krävs",
    className: "bg-red-500/10 text-red-700 border-transparent",
  },
  likely_required: {
    label: "Troligen krävs",
    className: "bg-amber-500/10 text-amber-700 border-transparent",
  },
  optional: {
    label: "Valfri",
    className: "bg-muted text-muted-foreground border-transparent",
  },
};

const STATUS_PILL: Record<string, { label: string; className: string }> = {
  not_started: {
    label: "Ej påbörjad",
    className: "bg-muted/60 text-muted-foreground",
  },
  suggested: {
    label: "Föreslagen",
    className: "bg-blue-500/10 text-blue-700",
  },
  needs_review: {
    label: "Granska",
    className: "bg-amber-500/10 text-amber-700",
  },
  reviewed: {
    label: "Granskad",
    className: "bg-emerald-500/10 text-emerald-700",
  },
  complete: {
    label: "Klar",
    className: "bg-green-500/10 text-green-700",
  },
  not_applicable: {
    label: "Ej tillämplig",
    className: "bg-muted/40 text-muted-foreground italic",
  },
  missing_info: {
    label: "Saknar info",
    className: "bg-red-500/10 text-red-700",
  },
};

function formatSek(value: string | null | undefined): string {
  if (!value) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n);
}

export function NoteCard({ note, onClick, onToggleNotApplicable }: NoteCardProps) {
  const isNA = note.status === "not_applicable";
  const reqBadge = REQUIREMENT_BADGE[note.requirementLevel] ?? REQUIREMENT_BADGE.optional;
  const statusPill = STATUS_PILL[note.status] ?? STATUS_PILL.not_started;
  const hasAcceptedText = !!note.acceptedText && note.acceptedText.length > 0;
  const isAi = note.textIsAiGenerated && hasAcceptedText;
  const missingValues =
    note.requirementLevel === "required" &&
    !note.currentYearValue &&
    !note.previousYearValue &&
    !isNA;

  return (
    <Card
      className={`shadow-sm transition-colors group ${
        isNA ? "opacity-60" : "hover:border-primary/50 cursor-pointer"
      }`}
      data-testid={`note-card-${note.noteType}`}
    >
      <div
        className="p-4 flex items-center gap-4"
        onClick={(e) => {
          // Don't trigger detail when clicking switch
          if ((e.target as HTMLElement).closest("[data-na-toggle]")) return;
          onClick();
        }}
      >
        {/* Number */}
        <div className="w-12 shrink-0">
          {note.noteNumber !== null ? (
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center font-mono font-semibold text-primary">
              {note.noteNumber}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center">
              <CircleDot className="h-4 w-4 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Title block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{note.title}</h3>
            <Badge variant="outline" className={`text-[10px] ${reqBadge.className}`}>
              {reqBadge.label}
            </Badge>
            {isAi && (
              <Badge
                variant="outline"
                className="text-[10px] bg-violet-500/10 text-violet-700 border-transparent gap-1"
              >
                <Sparkles className="h-2.5 w-2.5" />
                AI-utkast
              </Badge>
            )}
            {hasAcceptedText && !isAi && (
              <Badge
                variant="outline"
                className="text-[10px] bg-emerald-500/10 text-emerald-700 border-transparent gap-1"
              >
                <CheckCircle2 className="h-2.5 w-2.5" />
                Godkänd
              </Badge>
            )}
            {missingValues && (
              <Badge
                variant="outline"
                className="text-[10px] bg-red-500/10 text-red-700 border-transparent gap-1"
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                Värden saknas
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>Innevarande år: {formatSek(note.currentYearValue)} kr</span>
            <span>·</span>
            <span>Föregående år: {formatSek(note.previousYearValue)} kr</span>
            {!hasAcceptedText && !isNA && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <FileEdit className="h-3 w-3" /> Text saknas
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right side: status + NA toggle + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          <Badge
            variant="secondary"
            className={`${statusPill.className} border-transparent`}
          >
            {statusPill.label}
          </Badge>

          <div className="flex items-center gap-2 text-xs" data-na-toggle>
            <span className="text-muted-foreground hidden md:inline">Ej tillämplig</span>
            <Switch
              checked={isNA}
              onCheckedChange={onToggleNotApplicable}
              aria-label="Markera som ej tillämplig"
            />
          </div>

          {!isNA && (
            <Button
              variant="ghost"
              size="sm"
              className="opacity-50 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onClick(); }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
