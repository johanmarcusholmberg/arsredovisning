/**
 * Phase 6.6 + Phase 7 surface — the unified Preview & Export page.
 *
 * Shows the formal Swedish annual report exactly as it will be exported,
 * alongside an export-readiness panel, cover-sheet settings, the PDF/Word
 * generate buttons, and the export history list. Demo and unpaid projects
 * always render with the watermark.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileDown,
  FileText,
  History,
  Info,
  Loader2,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  fetchExportData,
  fetchExportHistory,
  fetchExportReadiness,
  generateExport,
  fetchExportDownloadUrl,
  updateExportCover,
} from "@/lib/exportApi";
import type {
  ReadinessLevel,
  ExportReadiness,
  CoverMode,
} from "@workspace/export-contract";
import { AnnualReportDocument } from "@/components/report/AnnualReportDocument";
import { WorkflowProgress } from "@/components/WorkflowProgress";

const QK = {
  data: (id: string) => ["export-data", id] as const,
  ready: (id: string) => ["export-readiness", id] as const,
  hist: (id: string) => ["export-history", id] as const,
};

export default function PreviewExport() {
  const params = useParams<{ reportId: string }>();
  const reportId = params.reportId;
  const qc = useQueryClient();
  const { toast } = useToast();

  const dataQ = useQuery({
    queryKey: QK.data(reportId),
    queryFn: () => fetchExportData(reportId),
    enabled: !!reportId,
  });
  const readyQ = useQuery({
    queryKey: QK.ready(reportId),
    queryFn: () => fetchExportReadiness(reportId),
    enabled: !!reportId,
  });
  const histQ = useQuery({
    queryKey: QK.hist(reportId),
    queryFn: () => fetchExportHistory(reportId),
    enabled: !!reportId,
  });

  const generateMut = useMutation({
    mutationFn: ({ format }: { format: "pdf" | "word" }) =>
      generateExport(reportId, format),
    onSuccess: async (resp) => {
      toast({
        title: "Export genererad",
        description: `${resp.filename} (${(resp.fileSize / 1024).toFixed(0)} KB)${
          resp.watermark ? " — vattenmärkt" : ""
        }`,
      });
      qc.invalidateQueries({ queryKey: QK.hist(reportId) });
      // Trigger immediate download via the typed download endpoint.
      try {
        const dl = await fetchExportDownloadUrl(resp.exportId);
        window.open(dl.downloadUrl, "_blank", "noopener,noreferrer");
      } catch {
        /* ignore — user can still download from history */
      }
    },
    onError: (err: Error) =>
      toast({
        title: "Kunde inte generera export",
        description: err.message,
        variant: "destructive",
      }),
  });

  const coverMut = useMutation({
    mutationFn: (patch: Parameters<typeof updateExportCover>[1]) =>
      updateExportCover(reportId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.data(reportId) });
      toast({ title: "Försättsblad uppdaterat" });
    },
  });

  if (!reportId) {
    return <div className="p-8">Saknar reportId.</div>;
  }

  if (dataQ.isLoading || readyQ.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-neutral-500">
        <Loader2 className="animate-spin mr-2" /> Laddar förhandsgranskning…
      </div>
    );
  }

  if (dataQ.isError || !dataQ.data) {
    const raw = (dataQ.error as Error | undefined)?.message ?? "";
    // The shared call() helper formats errors as "<status> <statusText>: <body.message>".
    const statusMatch = raw.match(/^(\d{3})\b/);
    const status = statusMatch ? Number(statusMatch[1]) : null;

    let title = "Kunde inte ladda exportdata";
    let description: React.ReactNode = "Ett oväntat fel inträffade. Försök igen om en stund.";
    let icon = <AlertCircle className="h-4 w-4" />;
    let tone: "destructive" | "default" = "destructive";

    if (status === 409) {
      // Report exists but has no paired annual_report_projects row.
      title = "Inget projekt kopplat — export inte tillgänglig";
      icon = <Lock className="h-4 w-4" />;
      description = (
        <>
          Den här rapporten är ännu inte kopplad till ett betalt projekt, vilket krävs
          för att kunna förhandsgranska och exportera årsredovisningen. Skapa eller
          aktivera ett projekt för rapportens räkenskapsår — kontakta din
          administratör om du är osäker.
        </>
      );
      tone = "default";
    } else if (status === 401 || status === 403) {
      title = "Saknar behörighet";
      description = "Du saknar behörighet till den här rapportens export.";
    } else if (status === 404) {
      title = "Rapporten hittades inte";
      description = "Den begärda rapporten finns inte eller är inte längre tillgänglig.";
    }

    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Link
          href={`/reports/${reportId}`}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          ← Tillbaka till rapporten
        </Link>
        <Alert variant={tone}>
          {icon}
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription className="space-y-2">
            <div>{description}</div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Tekniska detaljer</summary>
              <pre className="mt-1 whitespace-pre-wrap break-words">{raw || "okänt fel"}</pre>
            </details>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const data = dataQ.data;
  const readiness = readyQ.data ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      {/* ── Document preview ─────────────────────────────────────────── */}
      <div className="min-w-0">
        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-2xl font-bold">Förhandsgranskning &amp; Export</h1>
          {data.watermark.show && (
            <Badge variant="destructive">Vattenmärkt utkast</Badge>
          )}
        </div>
        <div className="bg-neutral-100 -mx-2 p-2 rounded-md overflow-x-auto">
          <AnnualReportDocument data={data} />
        </div>
      </div>

      {/* ── Side panel ──────────────────────────────────────────────── */}
      <aside className="space-y-4 lg:sticky lg:top-4 self-start">
        <WorkflowProgress
          currentStepId="preview"
          completedStepIds={[
            "import",
            "mapping",
            "structure",
            "statements",
            "notes",
            "reclassification",
            "validate",
            "collaborate",
          ]}
        />
        <ReadinessPanel readiness={readiness} />
        <CoverPanel
          data={data}
          onSave={(patch) => coverMut.mutate(patch)}
          saving={coverMut.isPending}
        />
        <ExportButtons
          canExportFinal={readiness?.canExportFinal ?? false}
          isWatermarked={data.watermark.show}
          onGenerate={(format) => generateMut.mutate({ format })}
          generating={generateMut.isPending}
          generatingFormat={generateMut.variables?.format ?? null}
        />
        <HistoryPanel
          entries={histQ.data?.entries ?? []}
          loading={histQ.isLoading}
        />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-panels
// ---------------------------------------------------------------------------

function ReadinessPanel({ readiness }: { readiness: ExportReadiness | null }) {
  if (!readiness) return null;
  const tone = ({
    blocking: "bg-destructive/10 text-destructive border-destructive/40",
    warning: "bg-amber-100 text-amber-900 border-amber-300",
    info: "bg-sky-50 text-sky-900 border-sky-200",
    ok: "bg-green-50 text-green-900 border-green-200",
  } as const)[readiness.level satisfies ReadinessLevel];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {readiness.level === "ok" ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : readiness.level === "blocking" ? (
            <ShieldAlert className="h-4 w-4 text-destructive" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-600" />
          )}
          Exportstatus
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className={`rounded-md border px-3 py-2 text-xs ${tone}`}>
          {readiness.level === "blocking" &&
            "Slutgiltig export är blockerad – åtgärda nedanstående."}
          {readiness.level === "warning" &&
            "Exporten är tillåten men har varningar."}
          {readiness.level === "info" && "Information om exporten."}
          {readiness.level === "ok" && "Rapporten är redo för export."}
        </div>
        <ul className="space-y-1 text-xs">
          {readiness.items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span
                className={
                  it.level === "blocking"
                    ? "text-destructive"
                    : it.level === "warning"
                    ? "text-amber-600"
                    : it.level === "info"
                    ? "text-sky-600"
                    : "text-green-600"
                }
              >
                •
              </span>
              <span>{it.message}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CoverPanel({
  data,
  onSave,
  saving,
}: {
  data: import("@workspace/export-contract").AnnualReportExportData;
  onSave: (patch: {
    mode?: CoverMode;
    title?: string | null;
    subtitle?: string | null;
    logoUrl?: string | null;
  }) => void;
  saving: boolean;
}) {
  const [mode, setMode] = useState<CoverMode>(data.cover.mode);
  const [title, setTitle] = useState(data.cover.title);
  const [subtitle, setSubtitle] = useState(data.cover.subtitle);
  const [logoUrl, setLogoUrl] = useState(data.cover.logoUrl ?? "");

  useEffect(() => {
    setMode(data.cover.mode);
    setTitle(data.cover.title);
    setSubtitle(data.cover.subtitle);
    setLogoUrl(data.cover.logoUrl ?? "");
  }, [data.cover]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" /> Försättsblad
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Läge</Label>
          <div className="flex gap-1 mt-1">
            {(["auto", "logo"] as CoverMode[]).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? "default" : "outline"}
                onClick={() => setMode(m)}
                className="text-xs h-7 flex-1"
              >
                {m === "auto" ? "Auto" : "Logotyp"}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs">Titel</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Underrubrik</Label>
          <Input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        {mode === "logo" && (
          <div>
            <Label className="text-xs">Logotyp-URL</Label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="h-8 text-sm"
              placeholder="https://…"
            />
          </div>
        )}
        <Button
          size="sm"
          className="w-full"
          disabled={saving}
          onClick={() =>
            onSave({
              mode,
              title,
              subtitle,
              logoUrl: mode === "logo" ? logoUrl || null : null,
            })
          }
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Spara försättsblad
        </Button>
      </CardContent>
    </Card>
  );
}

function ExportButtons({
  canExportFinal,
  isWatermarked,
  onGenerate,
  generating,
  generatingFormat,
}: {
  canExportFinal: boolean;
  isWatermarked: boolean;
  onGenerate: (format: "pdf" | "word") => void;
  generating: boolean;
  generatingFormat: "pdf" | "word" | null;
}) {
  const label = canExportFinal && !isWatermarked ? "Slutgiltig" : "Vattenmärkt utkast";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Download className="h-4 w-4" /> Generera export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-neutral-600">
          {isWatermarked
            ? "Detta projekt levereras alltid med vattenmärket DEMO – EJ FÖR INLÄMNING."
            : canExportFinal
            ? "Klart att laddas ner som slutgiltig årsredovisning."
            : "Slutgiltig export är blockerad – endast utkast kan laddas ner."}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={generating}
            onClick={() => onGenerate("pdf")}
          >
            {generating && generatingFormat === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <FileDown className="h-4 w-4 mr-1" />
            )}
            PDF ({label})
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={generating}
            onClick={() => onGenerate("word")}
          >
            {generating && generatingFormat === "word" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <FileDown className="h-4 w-4 mr-1" />
            )}
            Word ({label})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryPanel({
  entries,
  loading,
}: {
  entries: import("@workspace/export-contract").ExportHistoryEntry[];
  loading: boolean;
}) {
  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          new Date(b.generatedAt).getTime() -
          new Date(a.generatedAt).getTime(),
      ),
    [entries],
  );
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" /> Tidigare exporter
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-neutral-500">Laddar…</p>
        ) : sorted.length === 0 ? (
          <p className="text-xs text-neutral-500 flex items-center gap-1">
            <Info className="h-3 w-3" /> Inga exporter genererade ännu.
          </p>
        ) : (
          <ul className="space-y-2 text-xs">
            {sorted.map((e) => (
              <li key={e.id} className="border-b border-neutral-100 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{e.filename}</span>
                  <button
                    onClick={async () => {
                      try {
                        const dl = await fetchExportDownloadUrl(e.id);
                        window.open(dl.downloadUrl, "_blank", "noopener,noreferrer");
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="text-primary hover:underline shrink-0"
                  >
                    Hämta
                  </button>
                </div>
                <div className="text-neutral-500">
                  {new Date(e.generatedAt).toLocaleString("sv-SE")} · {e.format.toUpperCase()}
                  {e.watermark && " · vattenmärkt"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
