import { useState, useRef, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  FileUp, CheckCircle2, AlertTriangle, XCircle, Clock,
  ChevronDown, ChevronRight, Info, Upload, Loader2, ArrowRight,
  FileText, File
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColumnMappingStep } from "./ColumnMappingStep";
import { StagingPreview } from "./StagingPreview";

type BatchStatus = "pending" | "parsing" | "partial" | "parsed" | "failed" | "confirmed" | "cancelled";

interface ImportBatch {
  id: string;
  originalFilename: string;
  fileType: "sie" | "csv" | "excel";
  fileSizeBytes: number | null;
  status: BatchStatus;
  fiscalYearDetected: string | null;
  accountsFound: number;
  balancesFound: number;
  transactionsFound: number;
  parsingErrors: Array<{ section: string; message: string; severity: "warning" | "error" }>;
  isDemo: boolean;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ImportSectionProps {
  projectId: string;
  isDemo?: boolean;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}

function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const { t } = useLanguage();
  const configs: Record<BatchStatus, { color: string; icon: typeof CheckCircle2 }> = {
    pending: { color: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock },
    parsing: { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Loader2 },
    parsed: { color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
    partial: { color: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle },
    failed: { color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
    confirmed: { color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
    cancelled: { color: "bg-gray-100 text-gray-500 border-gray-200", icon: XCircle },
  };
  const { color, icon: Icon } = configs[status];
  const labelKey = `workspace.import.batch.status.${status}` as Parameters<typeof t>[0];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}>
      <Icon className={`size-3 ${status === "parsing" ? "animate-spin" : ""}`} />
      {t(labelKey)}
    </span>
  );
}

export function ImportSection({ projectId, isDemo = false }: ImportSectionProps) {
  const { t } = useLanguage();
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeBatch, setActiveBatch] = useState<ImportBatch | null>(null);
  const [step, setStep] = useState<"upload" | "colmap" | "staging">("upload");
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [showWhySIE, setShowWhySIE] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_EXTENSIONS = [".sie", ".si", ".se", ".csv", ".xlsx", ".xls"];
  const MAX_SIZE_MB = 50;

  function getFileType(filename: string): "sie" | "csv" | "excel" | null {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (!ext) return null;
    if (["sie", "si", "se"].includes(ext)) return "sie";
    if (ext === "csv") return "csv";
    if (["xlsx", "xls"].includes(ext)) return "excel";
    return null;
  }

  const handleFile = useCallback(async (file: File) => {
    setUploadError(null);
    const fileType = getFileType(file.name);
    if (!fileType) {
      setUploadError(`Filformat stöds inte. Tillåtna: ${ALLOWED_EXTENSIONS.join(", ")}`);
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setUploadError(`Filen är för stor. Max ${MAX_SIZE_MB} MB.`);
      return;
    }

    setUploading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/imports/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          originalFilename: file.name,
          fileType,
          fileSizeBytes: file.size,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Uppladdning misslyckades." }));
        setUploadError(err.message ?? "Uppladdning misslyckades.");
        return;
      }

      const batch = (await res.json()) as ImportBatch;
      setBatches((prev) => [batch, ...prev]);

      if (fileType === "sie") {
        const content = await readFileAsBase64(file);
        await parseSIEBatch(batch.id, content);
      } else {
        const content = await readFileAsBase64(file);
        setActiveBatch({ ...batch, _fileContent: content } as ImportBatch & { _fileContent: string });
        setStep("colmap");
      }
    } catch {
      setUploadError("Nätverksfel. Kontrollera din anslutning och försök igen.");
    } finally {
      setUploading(false);
    }
  }, [projectId]);

  async function parseSIEBatch(batchId: string, fileContent: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/imports/${batchId}/column-mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accountNumberColumn: "__sie__", fileContent }),
      });
      if (res.ok) {
        const updated = (await res.json()) as ImportBatch;
        setBatches((prev) => prev.map((b) => (b.id === batchId ? updated : b)));
        setActiveBatch(updated);
        setStep("staging");
      }
    } catch {
      // silently update — polling would show the state
    }
  }

  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleConfirm = async (batchId: string) => {
    const res = await fetch(`/api/projects/${projectId}/imports/${batchId}/confirm`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      const updated = (await res.json()) as ImportBatch;
      setBatches((prev) => prev.map((b) => (b.id === batchId ? updated : b)));
      setActiveBatch(null);
      setStep("upload");
    }
  };

  const handleCancel = async (batchId: string) => {
    const res = await fetch(`/api/projects/${projectId}/imports/${batchId}/cancel`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      const updated = (await res.json()) as ImportBatch;
      setBatches((prev) => prev.map((b) => (b.id === batchId ? updated : b)));
      setActiveBatch(null);
      setStep("upload");
    }
  };

  if (isDemo) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-muted/10 p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-full bg-blue-100 p-2">
              <Info className="size-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("workspace.import.demo.title")}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t("workspace.import.demo.desc")}</p>
            </div>
          </div>
          <div className="rounded-xl border-2 border-dashed border-border bg-background/50 p-10 text-center opacity-60">
            <FileUp className="size-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{t("workspace.import.upload.drag")}</p>
            <Button variant="outline" size="sm" className="mt-3" disabled>
              {t("workspace.import.upload.btn")}
            </Button>
          </div>
          <div className="mt-4 flex justify-center">
            <Button variant="default" size="sm">
              {t("workspace.import.demo.upgrade")} <ArrowRight className="size-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "colmap" && activeBatch) {
    return (
      <ColumnMappingStep
        batch={activeBatch as ImportBatch & { _fileContent?: string }}
        projectId={projectId}
        onDone={(updated) => {
          const updatedBatch = updated as ImportBatch;
          setBatches((prev) => prev.map((b) => (b.id === updatedBatch.id ? updatedBatch : b)));
          setActiveBatch(updatedBatch);
          setStep("staging");
        }}
        onCancel={() => { setActiveBatch(null); setStep("upload"); }}
      />
    );
  }

  if (step === "staging" && activeBatch && ["parsed", "partial"].includes(activeBatch.status)) {
    return (
      <StagingPreview
        batch={activeBatch}
        projectId={projectId}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("workspace.import.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("guidance.workspace.import")}</p>
      </div>

      {/* Upload area */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">{t("workspace.import.upload.title")}</h3>
          <button
            className="flex items-center gap-1 text-xs text-primary hover:underline"
            onClick={() => setShowWhySIE(!showWhySIE)}
          >
            <Info className="size-3" />
            {t("workspace.import.upload.sie.rec")}
          </button>
        </div>

        {showWhySIE && (
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            {t("workspace.import.upload.why_sie")}
          </div>
        )}

        {uploadError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
            <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{uploadError}</p>
          </div>
        )}

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`rounded-xl border-2 border-dashed transition-colors p-10 text-center cursor-pointer ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/10 hover:bg-muted/20 hover:border-muted-foreground/30"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="size-8 text-primary animate-spin" />
              <p className="text-sm font-medium text-foreground">{t("state.upload.preparing")}</p>
            </div>
          ) : (
            <>
              <Upload className="size-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">{t("workspace.import.upload.drag")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("workspace.import.upload.or")}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                {t("workspace.import.upload.btn")}
              </Button>
              <p className="text-xs text-muted-foreground mt-3">{t("workspace.import.upload.formats")}</p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".sie,.si,.se,.csv,.xlsx,.xls"
          className="hidden"
          onChange={onFileInput}
        />
      </div>

      {/* Import history */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">{t("workspace.import.history.title")}</h3>

        {batches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <FileText className="size-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">{t("workspace.import.history.empty")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("workspace.import.history.empty.desc")}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {batches.map((batch) => (
              <div key={batch.id} className="border-b border-border last:border-0">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedBatchId(expandedBatchId === batch.id ? null : batch.id)}
                >
                  <File className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground font-mono truncate">{batch.originalFilename}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(batch.createdAt)}</p>
                  </div>
                  <BatchStatusBadge status={batch.status} />
                  {expandedBatchId === batch.id ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </div>

                {expandedBatchId === batch.id && (
                  <div className="px-4 pb-4 border-t border-border bg-muted/5">
                    <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">{t("staging.accounts")}</p>
                        <p className="font-semibold text-foreground">{batch.accountsFound}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("staging.balances")}</p>
                        <p className="font-semibold text-foreground">{batch.balancesFound}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("staging.transactions")}</p>
                        <p className="font-semibold text-foreground">{batch.transactionsFound}</p>
                      </div>
                    </div>

                    {batch.fiscalYearDetected && (
                      <div className="mt-2 text-xs">
                        <span className="text-muted-foreground">{t("staging.fiscal_year")}: </span>
                        <span className="font-medium text-foreground">{batch.fiscalYearDetected}</span>
                      </div>
                    )}

                    {batch.parsingErrors.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {batch.parsingErrors.map((err, i) => (
                          <div key={i} className={`flex items-start gap-2 p-2 rounded text-xs ${err.severity === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                            {err.severity === "error" ? <XCircle className="size-3 shrink-0 mt-0.5" /> : <AlertTriangle className="size-3 shrink-0 mt-0.5" />}
                            <div>
                              <span className="font-mono font-medium">{err.section}: </span>
                              {err.message}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {["parsed", "partial"].includes(batch.status) && (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={() => { setActiveBatch(batch); setStep("staging"); }}>
                          {t("staging.confirm")} <ArrowRight className="size-3 ml-1" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleCancel(batch.id)}>
                          {t("staging.cancel")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
