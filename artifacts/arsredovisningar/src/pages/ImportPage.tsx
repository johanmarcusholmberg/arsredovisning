import { useRoute, Link, useLocation } from "wouter";
import { useState, useRef, ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProjectForReport,
  getGetProjectForReportQueryKey,
  useListImportBatches,
  getListImportBatchesQueryKey,
  useGetImportBatch,
  getGetImportBatchQueryKey,
  useUploadImportFile,
  useConfirmImportBatch,
  useCancelImportBatch,
  type ImportBatch,
  type ImportBatchDetail,
  type ImportBatchStatus,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  History,
  Lock,
  Info,
} from "lucide-react";

// ─── Allowed file formats ───────────────────────────────────────────────────
const ALLOWED_EXT = [".sie", ".se", ".csv", ".xlsx", ".xls"];
const MAX_FILE_SIZE_MB = 50;

function detectFileType(filename: string): "sie" | "csv" | "excel" | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "sie" || ext === "se") return "sie";
  if (ext === "csv") return "csv";
  if (ext === "xlsx" || ext === "xls") return "excel";
  return null;
}

function statusBadge(status: ImportBatchStatus) {
  switch (status) {
    case "confirmed":
      return <Badge className="bg-green-500/10 text-green-700 border-green-500/30 hover:bg-green-500/20">Bekräftad</Badge>;
    case "parsed":
      return <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/30 hover:bg-blue-500/20">Inläst — väntar på bekräftelse</Badge>;
    case "partial":
      return <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/20">Delvis inläst</Badge>;
    case "failed":
      return <Badge className="bg-red-500/10 text-red-700 border-red-500/30 hover:bg-red-500/20">Misslyckad</Badge>;
    case "cancelled":
      return <Badge variant="outline">Avbruten</Badge>;
    case "parsing":
      return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Bearbetar</Badge>;
    case "pending":
    default:
      return <Badge variant="secondary">Väntar</Badge>;
  }
}

export function ImportPage() {
  const [, params] = useRoute("/reports/:reportId/import");
  const reportId = params?.reportId || "";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // ── Resolve projectId from reportId ────────────────────────────────────────
  const {
    data: resolved,
    isLoading: isResolvingProject,
    error: resolveError,
  } = useGetProjectForReport(reportId, {
    query: { enabled: !!reportId, queryKey: getGetProjectForReportQueryKey(reportId) },
  });
  const projectId = resolved?.projectId ?? null;

  // ── Import batch list ─────────────────────────────────────────────────────
  const { data: batches, isLoading: isBatchesLoading } = useListImportBatches(projectId ?? "", {
    query: {
      enabled: !!projectId,
      queryKey: getListImportBatchesQueryKey(projectId ?? ""),
      refetchInterval: (q) => {
        const list = (q.state.data as ImportBatch[] | undefined) ?? [];
        const hasActive = list.some(
          (b) => b.status === "pending" || b.status === "parsing",
        );
        return hasActive ? 2000 : false;
      },
    },
  });

  // ── Active / focused batch detail ─────────────────────────────────────────
  const focusedBatchId =
    selectedBatchId ??
    batches?.find((b) =>
      ["parsed", "partial", "failed", "parsing", "pending"].includes(b.status),
    )?.id ??
    batches?.[0]?.id ??
    null;

  const { data: batchDetail } = useGetImportBatch(projectId ?? "", focusedBatchId ?? "", {
    query: {
      enabled: !!projectId && !!focusedBatchId,
      queryKey: getGetImportBatchQueryKey(projectId ?? "", focusedBatchId ?? ""),
      refetchInterval: (q) => {
        const data = q.state.data as ImportBatchDetail | undefined;
        if (data && (data.status === "parsing" || data.status === "pending")) return 2000;
        return false;
      },
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const uploadMutation = useUploadImportFile();
  const confirmMutation = useConfirmImportBatch();
  const cancelMutation = useCancelImportBatch();

  const invalidateLists = () => {
    if (!projectId) return;
    queryClient.invalidateQueries({ queryKey: getListImportBatchesQueryKey(projectId) });
    if (focusedBatchId) {
      queryClient.invalidateQueries({ queryKey: getGetImportBatchQueryKey(projectId, focusedBatchId) });
    }
  };

  // ── Upload handler ────────────────────────────────────────────────────────
  const handleFile = (file: File) => {
    if (!projectId) {
      toast({
        title: "Inget projekt kopplat",
        description: "Den här rapporten saknar ett kopplat projekt. Be administratören att koppla rapporten till ett betalt projekt.",
        variant: "destructive",
      });
      return;
    }
    const fileType = detectFileType(file.name);
    if (!fileType) {
      toast({
        title: "Filformat stöds inte",
        description: `Tillåtna format: ${ALLOWED_EXT.join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: "Filen är för stor",
        description: `Max ${MAX_FILE_SIZE_MB} MB. Den valda filen är ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(
      {
        projectId,
        data: {
          originalFilename: file.name,
          fileType,
          fileSizeBytes: file.size,
        },
      },
      {
        onSuccess: async (batch) => {
          setSelectedBatchId(batch.id);
          // If the back-end returned a signed upload URL, PUT the file bytes
          // there so the parser has actual content to read. If not, we still
          // surface the staged batch and let the back-end decide what to do.
          const uploadUrl = (batch as { uploadUrl?: string | null }).uploadUrl;
          if (uploadUrl) {
            try {
              await fetch(uploadUrl, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": file.type || "application/octet-stream" },
              });
            } catch {
              toast({
                title: "Kunde inte ladda upp filinnehållet",
                description: "Metadatat är registrerat, men filen nådde aldrig servern. Försök igen.",
                variant: "destructive",
              });
            }
          }
          invalidateLists();
          toast({
            title: "Uppladdning registrerad",
            description: `Filen "${file.name}" är registrerad. Bearbetning startar nu.`,
          });
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
        onError: (err: unknown) => {
          const e = err as { message?: string; status?: number };
          toast({
            title: "Uppladdning misslyckades",
            description: e?.message ?? "Okänt fel under uppladdning.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ── Confirm / cancel ──────────────────────────────────────────────────────
  const confirmBatch = () => {
    if (!projectId || !focusedBatchId) return;
    confirmMutation.mutate(
      { projectId, batchId: focusedBatchId },
      {
        onSuccess: () => {
          invalidateLists();
          toast({
            title: "Import bekräftad",
            description: "Datan har befordrats till projektet och konton mappas automatiskt.",
          });
          navigate(`/reports/${reportId}/mapping`);
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          toast({ title: "Bekräftelse misslyckades", description: e?.message ?? "Okänt fel.", variant: "destructive" });
        },
      },
    );
  };

  const cancelBatch = () => {
    if (!projectId || !focusedBatchId) return;
    cancelMutation.mutate(
      { projectId, batchId: focusedBatchId },
      {
        onSuccess: () => {
          invalidateLists();
          setSelectedBatchId(null);
          toast({ title: "Import avbruten", description: "Staging-data har raderats." });
        },
      },
    );
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (isResolvingProject) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (resolveError) {
    const status = (resolveError as { status?: number })?.status;
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <BackLink reportId={reportId} />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {status === 404
              ? "Rapporten hittades inte"
              : status === 401 || status === 403
              ? "Saknar behörighet"
              : "Kunde inte ladda rapporten"}
          </AlertTitle>
          <AlertDescription>
            {status === 404
              ? "Den begärda rapporten finns inte eller är inte längre tillgänglig."
              : status === 401 || status === 403
              ? "Du saknar behörighet till den här rapporten."
              : "Ett oväntat fel inträffade. Försök igen om en stund."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <BackLink reportId={reportId} />
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Inget projekt kopplat</AlertTitle>
          <AlertDescription>
            Den här rapporten är ännu inte kopplad till ett betalt projekt. Filimport kräver
            en aktiv projektlicens. Kontakta din administratör för att aktivera projektet.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <BackLink reportId={reportId} />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importera bokföringsdata</h1>
        <p className="text-muted-foreground mt-1">
          Ladda upp en SIE-fil (rekommenderas), Excel- eller CSV-fil. All data hamnar först
          i staging för granskning innan den befordras till projektet.
        </p>
      </div>

      {/* Upload card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Ny import
          </CardTitle>
          <CardDescription>
            <strong>SIE rekommenderas</strong> — BAS-konton, ingående/utgående balanser,
            transaktioner och räkenskapsår läses automatiskt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-10 text-center hover:bg-muted/30 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXT.join(",")}
              className="hidden"
              onChange={onFileInput}
              data-testid="file-input"
            />
            {uploadMutation.isPending ? (
              <Loader2 className="size-10 text-muted-foreground mx-auto mb-3 animate-spin" />
            ) : (
              <Upload className="size-10 text-muted-foreground mx-auto mb-3" />
            )}
            <p className="text-sm font-medium text-foreground">
              {uploadMutation.isPending
                ? "Laddar upp…"
                : "Dra och släpp en fil här, eller klicka för att välja"}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Tillåtna format: {ALLOWED_EXT.join(", ")} · max {MAX_FILE_SIZE_MB} MB
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Active batch preview */}
      {focusedBatchId && batchDetail && (
        <StagingPreview
          batch={batchDetail}
          onConfirm={confirmBatch}
          onCancel={cancelBatch}
          confirmPending={confirmMutation.isPending}
          cancelPending={cancelMutation.isPending}
        />
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Importhistorik
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isBatchesLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !batches || batches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Inga importer ännu. Ladda upp en fil för att komma igång.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filnamn</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Uppladdad</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Åtgärd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id} className={focusedBatchId === b.id ? "bg-muted/30" : ""}>
                    <TableCell className="font-mono text-xs">{b.originalFilename}</TableCell>
                    <TableCell className="uppercase text-xs">{b.fileType}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(b.createdAt).toLocaleString("sv-SE")}
                    </TableCell>
                    <TableCell>{statusBadge(b.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedBatchId(b.id)}
                      >
                        Visa
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function BackLink({ reportId }: { reportId: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Link href={`/reports/${reportId}`} className="hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" />
        Tillbaka till rapporten
      </Link>
    </div>
  );
}

function StagingPreview({
  batch,
  onConfirm,
  onCancel,
  confirmPending,
  cancelPending,
}: {
  batch: ImportBatchDetail;
  onConfirm: () => void;
  onCancel: () => void;
  confirmPending: boolean;
  cancelPending: boolean;
}) {
  const errors = batch.parsingErrors ?? [];
  const canConfirm = batch.status === "parsed" || batch.status === "partial";
  const isFinal =
    batch.status === "confirmed" || batch.status === "cancelled";

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {batch.originalFilename}
            </CardTitle>
            <CardDescription className="mt-1">
              Status: {statusBadge(batch.status)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {(batch.status === "pending" || batch.status === "parsing") && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Bearbetar fil</AlertTitle>
            <AlertDescription>
              Servern läser filen — det här tar normalt några sekunder. Sidan uppdateras automatiskt.
            </AlertDescription>
          </Alert>
        )}

        {batch.status === "failed" && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Inläsning misslyckades</AlertTitle>
            <AlertDescription>
              Filen kunde inte läsas in. Se fel nedan. Ingen data sparades — du kan ladda upp en ny fil.
            </AlertDescription>
          </Alert>
        )}

        {/* Summary grid */}
        {(batch.status === "parsed" || batch.status === "partial" || batch.status === "confirmed") && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Konton" value={batch.accountsFound ?? 0} />
            <Stat label="Saldon" value={batch.balancesFound ?? 0} />
            <Stat label="Transaktioner" value={batch.transactionsFound ?? 0} />
            <Stat
              label="Räkenskapsår"
              value={batch.fiscalYearDetected ?? "—"}
              mono
            />
          </div>
        )}

        {/* Parsing errors / unsupported sections */}
        {errors.length > 0 && (
          <Alert variant={batch.status === "failed" ? "destructive" : "default"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {batch.status === "partial" ? "Delvis inläst — följande hoppades över" : "Varningar vid inläsning"}
            </AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                {errors.map((err, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs text-muted-foreground">{err.section}:</span>{" "}
                    {err.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        {canConfirm && (
          <div className="flex items-center gap-3 pt-2 border-t">
            <Button onClick={onConfirm} disabled={confirmPending} data-testid="confirm-import">
              {confirmPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Bekräfta och befordra
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={cancelPending}>
              Avbryt och radera
            </Button>
            <p className="text-xs text-muted-foreground ml-auto">
              <Info className="h-3 w-3 inline mr-1" />
              Bekräftelse kör automapping och flyttar dig till mappningssidan.
            </p>
          </div>
        )}

        {isFinal && (
          <p className="text-xs text-muted-foreground border-t pt-3">
            Den här batchen är låst. {batch.status === "confirmed" && "Datan är aktiv i projektet."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, mono }: { label: string; value: number | string; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

