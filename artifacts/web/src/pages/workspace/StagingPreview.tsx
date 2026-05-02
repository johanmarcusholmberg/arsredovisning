import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import {
  CheckCircle2, AlertTriangle, XCircle, Loader2,
  Info, ChevronDown, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface StagingAccount {
  id: string;
  accountNumber: string;
  accountName: string | null;
  hasMissingName: boolean;
  openingBalance: string | null;
  closingBalance: string | null;
  currency: string;
}

interface ParsingError {
  section: string;
  message: string;
  severity: "warning" | "error";
}

interface StagingData {
  batchId: string;
  status: string;
  fiscalYearDetected: string | null;
  accountsFound: number;
  balancesFound: number;
  transactionsFound: number;
  missingNameAccounts: number;
  parsingErrors: ParsingError[];
  accounts: StagingAccount[];
}

interface BatchLike {
  id: string;
  originalFilename: string;
  status: string;
  accountsFound: number;
  balancesFound: number;
  transactionsFound: number;
  parsingErrors: ParsingError[];
  fiscalYearDetected: string | null;
}

interface StagingPreviewProps {
  batch: BatchLike;
  projectId: string;
  onConfirm: (batchId: string) => void;
  onCancel: (batchId: string) => void;
}

export function StagingPreview({ batch, projectId, onConfirm, onCancel }: StagingPreviewProps) {
  const { t } = useLanguage();
  const [staging, setStaging] = useState<StagingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showAccountsTable, setShowAccountsTable] = useState(false);

  useEffect(() => {
    async function loadStaging() {
      try {
        const res = await fetch(`/api/projects/${projectId}/imports/${batch.id}/staging`, {
          credentials: "include",
        });
        if (res.ok) {
          setStaging(await res.json());
        } else {
          setLoadError("Kunde inte ladda förhandsgranskning.");
        }
      } catch {
        setLoadError("Nätverksfel vid hämtning av förhandsgranskning.");
      } finally {
        setLoading(false);
      }
    }
    loadStaging();
  }, [batch.id, projectId]);

  const isPartial = batch.status === "partial";
  const errorCount = batch.parsingErrors.filter((e) => e.severity === "error").length;
  const warningCount = batch.parsingErrors.filter((e) => e.severity === "warning").length;

  const handleConfirm = async () => {
    setConfirming(true);
    await onConfirm(batch.id);
    setConfirming(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("staging.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1 font-mono">{batch.originalFilename}</p>
      </div>

      {isPartial && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{t("staging.partial.warning")}</p>
        </div>
      )}

      {/* Summary grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: t("staging.accounts"), value: batch.accountsFound, color: "text-foreground" },
          { label: t("staging.balances"), value: batch.balancesFound, color: "text-foreground" },
          { label: t("staging.transactions"), value: batch.transactionsFound, color: "text-foreground" },
          { label: t("staging.missing_names"), value: staging?.missingNameAccounts ?? 0, color: (staging?.missingNameAccounts ?? 0) > 0 ? "text-amber-600" : "text-foreground" },
          { label: t("staging.warnings"), value: warningCount, color: warningCount > 0 ? "text-amber-600" : "text-foreground" },
          { label: t("staging.errors"), value: errorCount, color: errorCount > 0 ? "text-red-600" : "text-foreground" },
        ].map((item, i) => (
          <div key={i} className="rounded-lg border border-border bg-muted/5 p-3">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`text-lg font-semibold mt-1 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Fiscal year */}
      {batch.fiscalYearDetected && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/5">
          <Info className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{t("staging.fiscal_year")}:</span>
          <span className="text-sm font-medium text-foreground">{batch.fiscalYearDetected}</span>
        </div>
      )}

      {/* Parsing errors and warnings */}
      {batch.parsingErrors.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {t("staging.warnings")} & {t("staging.errors")}
          </h3>
          {batch.parsingErrors.map((err, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                err.severity === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {err.severity === "error" ? (
                <XCircle className="size-4 shrink-0 mt-0.5 text-red-500" />
              ) : (
                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
              )}
              <div>
                <p className="font-mono font-medium text-xs">{err.section}</p>
                <p className="mt-0.5 text-xs">{err.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accounts preview table */}
      <div>
        <button
          className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2"
          onClick={() => setShowAccountsTable(!showAccountsTable)}
        >
          {showAccountsTable ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          {t("staging.accounts.table.title")} ({batch.accountsFound})
        </button>

        {showAccountsTable && (
          <div className="rounded-xl border border-border overflow-hidden">
            {loading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : loadError ? (
              <div className="p-4 text-sm text-red-600">{loadError}</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Konto</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Namn</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Ingående</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Utgående</th>
                  </tr>
                </thead>
                <tbody>
                  {(staging?.accounts ?? []).slice(0, 50).map((acc) => (
                    <tr key={acc.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                      <td className="px-3 py-2 font-mono font-medium text-foreground">{acc.accountNumber}</td>
                      <td className="px-3 py-2 text-foreground">
                        {acc.accountName ?? (
                          <span className="text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="size-3" />
                            Namn saknas
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground font-mono">
                        {acc.openingBalance ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground font-mono">
                        {acc.closingBalance ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {(staging?.accounts ?? []).length > 50 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-center text-muted-foreground">
                        ...och {(staging?.accounts ?? []).length - 50} fler konton
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Confirm description */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50/50">
        <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">{t("staging.confirm.desc")}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          size="sm"
          className="flex-1 sm:flex-none"
          onClick={handleConfirm}
          disabled={confirming || errorCount > 0}
        >
          {confirming ? (
            <><Loader2 className="size-3 mr-2 animate-spin" /> Bekräftar...</>
          ) : (
            <><CheckCircle2 className="size-3 mr-2" /> {t("staging.confirm")}</>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onCancel(batch.id)}
          disabled={confirming}
        >
          <XCircle className="size-3 mr-2" />
          {t("staging.cancel")}
        </Button>
      </div>
    </div>
  );
}
