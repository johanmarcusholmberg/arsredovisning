import { useState } from "react";
import {
  useGetMappingAssistantSuggestion,
  getGetMappingAssistantSuggestionQueryKey,
  type MappingAssistantSuggestion,
  type MappingAssistantSuggestionConfidence,
  type MappingAssistantSuggestionSeverity,
  type MappingAssistantSuggestionRecommendedAction,
} from "@workspace/api-client-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sparkles,
  AlertTriangle,
  Info,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  Wand2,
} from "lucide-react";

const SEVERITY_META: Record<
  MappingAssistantSuggestionSeverity,
  { icon: typeof Info; cls: string; label: string }
> = {
  info: {
    icon: Info,
    cls: "border-sky-300/60 bg-sky-50/60 text-sky-900 dark:text-sky-200",
    label: "Information",
  },
  warning: {
    icon: AlertTriangle,
    cls: "border-amber-300/60 bg-amber-50/60 text-amber-900 dark:text-amber-200",
    label: "Granska",
  },
  blocking: {
    icon: ShieldAlert,
    cls: "border-red-300/60 bg-red-50/60 text-red-900 dark:text-red-200",
    label: "Måste åtgärdas",
  },
};

const CONFIDENCE_LABEL: Record<MappingAssistantSuggestionConfidence, string> = {
  low: "Låg konfidens",
  medium: "Medel konfidens",
  high: "Hög konfidens",
};

const ACTION_LABEL: Record<MappingAssistantSuggestionRecommendedAction, string> = {
  keep: "Behåll nuvarande mappning",
  remap: "Mappa om till föreslagen rad",
  net: "Granska för nettning mot motsvarande sak-grupp",
  review: "Granska manuellt",
  manual_adjustment: "Behöver manuell justering",
};

interface Props {
  projectId: string;
  mappingId: string;
  /**
   * When the user accepts the suggested row, propagate it back to the
   * OverrideDialog form. Receives (suggestedRowId, suggestedRowLabel).
   */
  onApplySuggestion?: (rowId: string, rowLabel: string) => void;
}

export function MappingAssistantPanel({
  projectId,
  mappingId,
  onApplySuggestion,
}: Props) {
  const [expertOpen, setExpertOpen] = useState(false);
  const [altsOpen, setAltsOpen] = useState(false);

  const { data, isLoading, isError, error } = useGetMappingAssistantSuggestion(
    projectId,
    mappingId,
    {
      query: {
        enabled: !!projectId && !!mappingId,
        staleTime: 30_000,
        queryKey: getGetMappingAssistantSuggestionQueryKey(projectId, mappingId),
      },
    },
  );

  if (isLoading) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          AI-stöd & smarta regler
        </div>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Alert variant="default" className="text-xs">
        <Info className="h-4 w-4" />
        <AlertTitle>AI-stöd otillgängligt just nu</AlertTitle>
        <AlertDescription>
          Vi kunde inte hämta ett förslag för det här kontot.
          {error instanceof Error ? ` (${error.message})` : null}
        </AlertDescription>
      </Alert>
    );
  }

  const suggestion: MappingAssistantSuggestion = data;
  const meta = SEVERITY_META[suggestion.severity];
  const Icon = meta.icon;
  const canApply =
    suggestion.suggestedRowId &&
    suggestion.suggestedRowLabel &&
    suggestion.suggestedRowId !== suggestion.currentRowId &&
    !!onApplySuggestion;

  return (
    <div className={`rounded-md border ${meta.cls} p-3 space-y-3`}>
      {/* Header */}
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
            <Sparkles className="h-3 w-3" />
            AI-stöd &amp; smarta regler
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
              {CONFIDENCE_LABEL[suggestion.confidence]}
            </Badge>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
              {meta.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {suggestion.source === "ai" ? "AI-genererat" : "Regelbaserat"}
            </span>
          </div>
          <p className="text-sm font-medium leading-snug">{suggestion.reason}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {suggestion.explanation}
          </p>
        </div>
      </div>

      {/* Recommended action */}
      <div className="rounded border border-current/10 bg-background/40 p-2 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <Wand2 className="h-3 w-3" />
          <span className="font-medium">Rekommenderad åtgärd:</span>
          <span>{ACTION_LABEL[suggestion.recommendedAction]}</span>
        </div>
        {suggestion.suggestedRowLabel && (
          <div className="text-muted-foreground">
            Föreslagen rad:{" "}
            <span className="font-mono text-foreground">
              {suggestion.suggestedRowId}
            </span>{" "}
            — {suggestion.suggestedRowLabel}
          </div>
        )}
        {canApply && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-1 h-7 text-xs"
            onClick={() =>
              onApplySuggestion!(
                suggestion.suggestedRowId!,
                suggestion.suggestedRowLabel!,
              )
            }
          >
            Använd förslag
          </Button>
        )}
      </div>

      {/* Alternatives */}
      {suggestion.alternatives.length > 0 && (
        <Collapsible open={altsOpen} onOpenChange={setAltsOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium hover:underline">
            {altsOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {suggestion.alternatives.length} närliggande rader
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1">
            {suggestion.alternatives.map((a) => (
              <div
                key={a.reportLine}
                className="flex items-start justify-between gap-2 text-xs rounded border bg-background/40 p-2"
              >
                <div className="min-w-0">
                  <div className="font-mono truncate">{a.reportLine}</div>
                  <div className="text-muted-foreground truncate">
                    {a.reportLineLabel}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {a.reason}
                  </div>
                </div>
                {onApplySuggestion && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[11px] shrink-0"
                    onClick={() =>
                      onApplySuggestion(a.reportLine, a.reportLineLabel)
                    }
                  >
                    Välj
                  </Button>
                )}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Expert / audit */}
      <Collapsible open={expertOpen} onOpenChange={setExpertOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-muted-foreground hover:underline">
          {expertOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Visa expertdetaljer (revisionsspår)
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono">
            <dt className="text-muted-foreground">BAS-intervall</dt>
            <dd>{suggestion.expert.basRange ?? "—"}</dd>
            <dt className="text-muted-foreground">BAS-grupp</dt>
            <dd>{suggestion.expert.basGroup ?? "—"}</dd>
            <dt className="text-muted-foreground">Antagen sida</dt>
            <dd>{suggestion.expert.inferredSign}</dd>
            <dt className="text-muted-foreground">Förväntad rad</dt>
            <dd className="truncate">
              {suggestion.expert.expectedReportLine ?? "—"}
            </dd>
          </dl>
          {suggestion.expert.notes.length > 0 && (
            <ul className="mt-2 list-disc pl-4 space-y-0.5 text-[11px]">
              {suggestion.expert.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">
            Förslaget är endast vägledande. Användaren ansvarar alltid för
            slutlig klassificering. Ändringar loggas i revisionsspåret.
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
