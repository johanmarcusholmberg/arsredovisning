/**
 * Phase 6.6 + Phase 7 surface — the unified Preview & Export page.
 *
 * Shows the formal Swedish annual report exactly as it will be exported,
 * alongside an export-readiness panel, cover-sheet settings (including
 * upload), the PDF/Word generate buttons, the package builder, and the
 * export history list. Demo and unpaid projects always render with the
 * watermark.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Package,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  fetchExportData,
  fetchExportHistory,
  fetchExportReadiness,
  fetchProjectExportState,
  generateExport,
  generateExportPackage,
  fetchExportDownloadUrl,
  updateExportCover,
  uploadCoverFile,
} from "@/lib/exportApi";
import type {
  ReadinessLevel,
  ExportReadiness,
  CoverMode,
  ProjectExportState,
  ExportHistoryEntry,
} from "@workspace/export-contract";
import { AnnualReportDocument } from "@/components/report/AnnualReportDocument";
import { WorkflowProgress } from "@/components/WorkflowProgress";

const QK = {
  data: (id: string) => ["export-data", id] as const,
  ready: (id: string) => ["export-readiness", id] as const,
  hist: (id: string) => ["export-history", id] as const,
  state: (id: string) => ["export-state", id] as const,
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
  const stateQ = useQuery({
    queryKey: QK.state(reportId),
    queryFn: () => fetchProjectExportState(reportId),
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
      qc.invalidateQueries({ queryKey: QK.state(reportId) });
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

  const packageMut = useMutation({
    mutationFn: (opts: {
      format: "pdf" | "word";
      includeValidationSummary: boolean;
      includeAuditSummary: boolean;
    }) => generateExportPackage(reportId, opts),
    onSuccess: async (resp) => {
      toast({
        title: "Exportpaket skapat",
        description: `${resp.filename}${
          resp.appendixIds.length > 0
            ? ` + ${resp.appendixIds.length} bilaga(or)`
            : ""
        }`,
      });
      qc.invalidateQueries({ queryKey: QK.hist(reportId) });
      qc.invalidateQueries({ queryKey: QK.state(reportId) });
      try {
        const dl = await fetchExportDownloadUrl(resp.primaryExportId);
        window.open(dl.downloadUrl, "_blank", "noopener,noreferrer");
      } catch {
        /* ignore */
      }
    },
    onError: (err: Error) =>
      toast({
        title: "Kunde inte skapa exportpaket",
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
    const statusMatch = raw.match(/^(\d{3})\b/);
    const status = statusMatch ? Number(statusMatch[1]) : null;

    let title = "Kunde inte ladda exportdata";
    let description: React.ReactNode = "Ett oväntat fel inträffade. Försök igen om en stund.";
    let icon = <AlertCircle className="h-4 w-4" />;
    let tone: "destructive" | "default" = "destructive";

    if (status === 409) {
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
  const projectId = (data as { projectId?: string } | undefined)?.projectId ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      {/* ── Document preview ─────────────────────────────────────────── */}
      <div className="min-w-0">
        <div className="flex items-baseline justify-between mb-4 gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Förhandsgranskning &amp; Export</h1>
          <ProjectStateBadge state={stateQ.data?.state ?? null} />
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
          projectId={projectId}
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
        <PackageBuilder
          canExportFinal={readiness?.canExportFinal ?? false}
          isWatermarked={data.watermark.show}
          onGenerate={(opts) => packageMut.mutate(opts)}
          generating={packageMut.isPending}
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

function ProjectStateBadge({ state }: { state: ProjectExportState | null }) {
  if (!state) return null;
  const cfg: Record<ProjectExportState, { label: string; cls: string }> = {
    demo: { label: "Demo", cls: "bg-amber-100 text-amber-900 border-amber-300" },
    blocked: { label: "Blockerad", cls: "bg-red-100 text-red-900 border-red-300" },
    ready: { label: "Klar", cls: "bg-sky-100 text-sky-900 border-sky-300" },
    paid: { label: "Betalad", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
    already_exported: {
      label: "Redan exporterad",
      cls: "bg-violet-100 text-violet-900 border-violet-300",
    },
  };
  const c = cfg[state];
  return (
    <span
      className={`text-xs font-medium px-2 py-1 rounded-md border ${c.cls}`}
      title={`Projektstatus: ${c.label}`}
    >
      {c.label}
    </span>
  );
}

function ReadinessPanel({ readiness }: { readiness: ExportReadiness | null }) {
  if (!readiness) return null;
  const tone = ({
    blocking: "bg-destructive/10 text-destructive border-destructive/40",
    warning: "bg-amber-100 text-amber-900 border-amber-300",
    info: "bg-sky-50 text-sky-900 border-sky-200",
    ok: "bg-green-50 text-green-900 border-green-200",
  } as const)[readiness.level satisfies ReadinessLevel];

  // Spec §17 wording — exact text required for the readiness panel.
  const headline =
    readiness.level === "blocking"
      ? "Export är blockerad eftersom obligatoriska problem kvarstår."
      : readiness.level === "ok" || readiness.level === "info"
      ? "Inga blockerande valideringsproblem hittades. Granska gärna innan inlämning."
      : "Exporten är tillåten men har varningar — granska gärna innan inlämning.";

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
          {headline}
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
  projectId,
  onSave,
  saving,
}: {
  data: import("@workspace/export-contract").AnnualReportExportData;
  projectId: string | null;
  onSave: (patch: {
    mode?: CoverMode;
    title?: string | null;
    subtitle?: string | null;
    logoUrl?: string | null;
    uploadedFileId?: string | null;
  }) => void;
  saving: boolean;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<CoverMode>(data.cover.mode);
  const [title, setTitle] = useState(data.cover.title);
  const [subtitle, setSubtitle] = useState(data.cover.subtitle);
  const [logoUrl, setLogoUrl] = useState(data.cover.logoUrl ?? "");
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(
    data.cover.uploadedFileId ?? null,
  );
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMode(data.cover.mode);
    setTitle(data.cover.title);
    setSubtitle(data.cover.subtitle);
    setLogoUrl(data.cover.logoUrl ?? "");
    setUploadedFileId(data.cover.uploadedFileId ?? null);
  }, [data.cover]);

  async function handlePick(file: File) {
    if (!projectId) {
      toast({
        title: "Projekt saknas",
        description: "Kan inte ladda upp försättsblad utan kopplat projekt.",
        variant: "destructive",
      });
      return;
    }
    const okType = ["application/pdf", "image/png", "image/jpeg"].includes(file.type);
    if (!okType) {
      toast({
        title: "Filformat stöds inte",
        description: "Tillåtna format: PDF, PNG, JPEG.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Filen är för stor",
        description: "Max 10 MB för försättsblad.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const { fileId } = await uploadCoverFile({ projectId, file });
      setUploadedFileId(fileId);
      setUploadedFileName(file.name);
      toast({ title: "Försättsblad uppladdat", description: file.name });
    } catch (err) {
      toast({
        title: "Uppladdning misslyckades",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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
            {(["auto", "logo", "uploaded"] as CoverMode[]).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? "default" : "outline"}
                onClick={() => setMode(m)}
                className="text-xs h-7 flex-1"
              >
                {m === "auto" ? "Auto" : m === "logo" ? "Logotyp" : "Uppladdad"}
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
        {mode === "uploaded" && (
          <div className="space-y-2">
            <Label className="text-xs">Uppladdad fil</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePick(f);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs"
              disabled={uploading || !projectId}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Upload className="h-3.5 w-3.5 mr-1" />
              )}
              {uploadedFileId ? "Ersätt fil…" : "Välj PDF eller bild…"}
            </Button>
            {uploadedFileId && (
              <p className="text-[11px] text-neutral-600 truncate">
                Vald: {uploadedFileName ?? `(fil-id ${uploadedFileId.slice(0, 8)}…)`}
              </p>
            )}
            <p className="text-[11px] text-amber-700">
              Obs: Förhandsgranskningen visar fortfarande den autogenererade
              försättssidan. Den uppladdade filen levereras med exporten men
              sammanfogning av första sidan i PDF:en sker i Phase 8.
            </p>
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
              uploadedFileId: mode === "uploaded" ? uploadedFileId : null,
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

function PackageBuilder({
  canExportFinal,
  isWatermarked,
  onGenerate,
  generating,
}: {
  canExportFinal: boolean;
  isWatermarked: boolean;
  onGenerate: (opts: {
    format: "pdf" | "word";
    includeValidationSummary: boolean;
    includeAuditSummary: boolean;
  }) => void;
  generating: boolean;
}) {
  const [format, setFormat] = useState<"pdf" | "word">("pdf");
  const [includeValidationSummary, setVal] = useState(true);
  const [includeAuditSummary, setAud] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4" /> Exportpaket
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-neutral-600">
          Skapa ett samlat paket med årsredovisningen plus valfria bilagor.
          Bilagorna ingår aldrig i det formella dokumentet.
        </p>
        <div>
          <Label className="text-xs">Huvudformat</Label>
          <div className="flex gap-1 mt-1">
            {(["pdf", "word"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={format === f ? "default" : "outline"}
                onClick={() => setFormat(f)}
                className="text-xs h-7 flex-1"
              >
                {f.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox
              checked={includeValidationSummary}
              onCheckedChange={(v) => setVal(v === true)}
            />
            Bifoga valideringssammanställning (PDF)
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox
              checked={includeAuditSummary}
              onCheckedChange={(v) => setAud(v === true)}
            />
            Bifoga ändringshistorik (PDF)
          </label>
        </div>
        <Button
          size="sm"
          className="w-full"
          disabled={generating || (!canExportFinal && !isWatermarked)}
          onClick={() =>
            onGenerate({ format, includeValidationSummary, includeAuditSummary })
          }
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Package className="h-4 w-4 mr-1" />
          )}
          Skapa paket
        </Button>
      </CardContent>
    </Card>
  );
}

function HistoryPanel({
  entries,
  loading,
}: {
  entries: ExportHistoryEntry[];
  loading: boolean;
}) {
  // Group by packageId so a package + its appendices appear as a single
  // entry in the history list (spec §15).
  const grouped = useMemo(() => {
    const sorted = [...entries].sort(
      (a, b) =>
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
    );
    const groups: Array<{
      key: string;
      primary: ExportHistoryEntry;
      appendices: ExportHistoryEntry[];
    }> = [];
    const seen = new Set<string>();
    for (const e of sorted) {
      if (e.packageId) {
        if (seen.has(e.packageId)) continue;
        seen.add(e.packageId);
        const inGroup = sorted.filter((x) => x.packageId === e.packageId);
        // The first one created (oldest) is the primary report; the others
        // are the appendices.
        const primary =
          inGroup.find(
            (x) => x.label && !/sammanställning|historik/i.test(x.label),
          ) ?? inGroup[0];
        groups.push({
          key: e.packageId,
          primary,
          appendices: inGroup.filter((x) => x.id !== primary.id),
        });
      } else {
        groups.push({ key: e.id, primary: e, appendices: [] });
      }
    }
    return groups;
  }, [entries]);

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
        ) : grouped.length === 0 ? (
          <p className="text-xs text-neutral-500 flex items-center gap-1">
            <Info className="h-3 w-3" /> Inga exporter genererade ännu.
          </p>
        ) : (
          <ul className="space-y-2 text-xs">
            {grouped.map((g) => (
              <li key={g.key} className="border-b border-neutral-100 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate flex items-center gap-1">
                    {g.appendices.length > 0 && (
                      <Package className="h-3 w-3 text-neutral-500" />
                    )}
                    {g.primary.filename}
                  </span>
                  <button
                    onClick={async () => {
                      try {
                        const dl = await fetchExportDownloadUrl(g.primary.id);
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
                  {new Date(g.primary.generatedAt).toLocaleString("sv-SE")} ·{" "}
                  {g.primary.format.toUpperCase()}
                  {g.primary.watermark && " · vattenmärkt"}
                </div>
                {g.appendices.length > 0 && (
                  <ul className="mt-1 ml-3 space-y-0.5 text-[11px] text-neutral-600">
                    {g.appendices.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">↳ {a.label ?? a.filename}</span>
                        <button
                          onClick={async () => {
                            try {
                              const dl = await fetchExportDownloadUrl(a.id);
                              window.open(dl.downloadUrl, "_blank", "noopener,noreferrer");
                            } catch {
                              /* ignore */
                            }
                          }}
                          className="text-primary hover:underline shrink-0"
                        >
                          Hämta
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
