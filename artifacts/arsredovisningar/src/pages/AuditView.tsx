import { useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useListAuditEvents,
  getListAuditEventsQueryKey,
  useListProjectSnapshots,
  getListProjectSnapshotsQueryKey,
  useCreateProjectSnapshot,
  type AuditEvent,
  type ProjectSnapshot,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  History,
  Camera,
  Loader2,
  ClipboardList,
  Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_LABELS: Record<string, string> = {
  all: "Alla",
  validation: "Validering",
  note: "Noter",
  comment: "Kommentarer",
  review: "Granskning",
  user: "Användare",
  snapshot: "Ögonblicksbilder",
  statements: "Rapporter",
  sie: "SIE-import",
};

function eventLabel(eventType: string): string {
  const map: Record<string, string> = {
    "validation.run": "Validering körd",
    "validation.dismiss": "Varning avfärdad",
    "review.status_changed": "Granskningsstatus ändrad",
    "review.assigned": "Granskare tilldelad",
    "comment.created": "Kommentar skapad",
    "comment.resolved": "Kommentar åtgärdad",
    "comment.reopened": "Kommentar återöppnad",
    "user.invited": "Användare inbjuden",
    "user.removed": "Användare borttagen",
    "snapshot.created": "Ögonblicksbild skapad",
    "note.created": "Not skapad",
    "note.updated": "Not uppdaterad",
    note_status_changed: "Notstatus ändrad",
    note_text_accepted: "Nottext godkänd",
    note_text_ai_generated: "AI-utkast genererat",
    note_text_edited: "Nottext redigerad",
    note_marked_not_applicable: "Not markerad ej tillämplig",
    note_suggested: "Notförslag",
    note_numbering_recalculated: "Notnumrering omräknad",
    note_reference_removed: "Notreferens borttagen",
    "statements.generated": "Finansiella rapporter genererade",
  };
  return map[eventType] ?? eventType;
}

function eventCategory(eventType: string): string {
  if (eventType.startsWith("validation")) return "validation";
  if (eventType.startsWith("note")) return "note";
  if (eventType.startsWith("comment")) return "comment";
  if (eventType.startsWith("review")) return "review";
  if (eventType.startsWith("user")) return "user";
  if (eventType.startsWith("snapshot")) return "snapshot";
  if (eventType.startsWith("statements")) return "statements";
  if (eventType.startsWith("sie")) return "sie";
  return "other";
}

export function AuditView() {
  const [, params] = useRoute("/reports/:reportId/audit");
  const reportId = params?.reportId ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<string>("all");
  const [snapshotLabel, setSnapshotLabel] = useState("");

  const auditParams = filter === "all" ? { limit: 200 } : { limit: 200, category: filter };

  const { data: eventsData, isLoading } = useListAuditEvents(reportId, auditParams, {
    query: {
      enabled: !!reportId,
      queryKey: getListAuditEventsQueryKey(reportId, auditParams),
    },
  });

  const { data: snapshotsData } = useListProjectSnapshots(reportId, {
    query: {
      enabled: !!reportId,
      queryKey: getListProjectSnapshotsQueryKey(reportId),
    },
  });

  const createSnapshot = useCreateProjectSnapshot();

  const events: AuditEvent[] = eventsData?.events ?? [];
  const snapshots: ProjectSnapshot[] = snapshotsData?.snapshots ?? [];

  const handleSnapshot = () => {
    if (!snapshotLabel.trim()) return;
    createSnapshot.mutate(
      { reportId, data: { label: snapshotLabel.trim() } },
      {
        onSuccess: () => {
          toast({ title: "Ögonblicksbild sparad" });
          setSnapshotLabel("");
          qc.invalidateQueries({ queryKey: getListProjectSnapshotsQueryKey(reportId) });
          qc.invalidateQueries({ queryKey: getListAuditEventsQueryKey(reportId, auditParams) });
        },
        onError: (e) =>
          toast({
            title: "Kunde inte spara",
            description: String(e),
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
      <Link
        href={`/reports/${reportId}`}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Tillbaka till rapport
      </Link>

      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <History className="h-7 w-7 text-primary" />
          Aktivitet &amp; revisionsspår
        </h1>
        <p className="text-muted-foreground mt-1">
          Komplett, oföränderlig historik över ändringar. Spara ögonblicksbilder för att kunna jämföra över tid.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity feed */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Händelser
                <Badge variant="secondary">{events.length}</Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  className="border rounded px-2 py-1 text-sm bg-background"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Inga händelser för det här filtret.
              </p>
            ) : (
              events.map((e) => (
                <div key={e.id} className="border rounded p-3 flex items-start gap-3">
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wide shrink-0"
                  >
                    {CATEGORY_LABELS[eventCategory(e.eventType)] ?? "Övrigt"}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{eventLabel(e.eventType)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {e.actorName ?? "Systemet"} ·{" "}
                      {new Date(e.createdAt).toLocaleString("sv-SE")}
                    </div>
                    {e.eventData && Object.keys(e.eventData).length > 0 && (
                      <details className="mt-1">
                        <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                          Detaljer
                        </summary>
                        <pre className="mt-1 text-[11px] bg-muted/30 rounded p-2 overflow-x-auto">
                          {JSON.stringify(e.eventData, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Snapshots */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Ögonblicksbilder
              <Badge variant="secondary">{snapshots.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Input
                placeholder="t.ex. 'Före revisorsgranskning'"
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={handleSnapshot}
                disabled={createSnapshot.isPending || !snapshotLabel.trim()}
              >
                {createSnapshot.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Camera className="mr-2 h-4 w-4" />
                Spara ögonblicksbild
              </Button>
            </div>

            <div className="border-t pt-3 space-y-2">
              {snapshots.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Inga sparade ögonblicksbilder ännu.
                </p>
              ) : (
                snapshots.map((s) => (
                  <div key={s.id} className="border rounded p-3">
                    <div className="font-medium text-sm">{s.label ?? "(utan namn)"}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {s.actorName ?? "Systemet"} ·{" "}
                      {new Date(s.createdAt).toLocaleString("sv-SE")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
