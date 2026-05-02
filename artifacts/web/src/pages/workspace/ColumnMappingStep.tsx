import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AlertTriangle, Loader2, ArrowRight, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ColumnField {
  key: string;
  labelKey: string;
  required: boolean;
  stateKey: keyof ColumnMapping;
}

interface ColumnMapping {
  accountNumberColumn: string;
  accountNameColumn: string;
  openingBalanceColumn: string;
  closingBalanceColumn: string;
  amountColumn: string;
  dateColumn: string;
  descriptionColumn: string;
}

interface BatchLike {
  id: string;
  originalFilename: string;
  fileType: "sie" | "csv" | "excel";
  _fileContent?: string;
}

interface ColumnMappingStepProps {
  batch: BatchLike;
  projectId: string;
  onDone: (updated: BatchLike) => void;
  onCancel: () => void;
}

function detectHeadersFromBase64(b64: string, filename: string): string[] {
  try {
    const text = atob(b64);
    const firstLine = text.split(/\r?\n/)[0] ?? "";
    const semiCount = (firstLine.match(/;/g) ?? []).length;
    const commaCount = (firstLine.match(/,/g) ?? []).length;
    const tabCount = (firstLine.match(/\t/g) ?? []).length;
    let delimiter = ",";
    if (semiCount > commaCount && semiCount > tabCount) delimiter = ";";
    else if (tabCount > commaCount) delimiter = "\t";
    return firstLine.split(delimiter).map((h) => h.replace(/^"|"$/g, "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function ColumnMappingStep({ batch, projectId, onDone, onCancel }: ColumnMappingStepProps) {
  const { t } = useLanguage();
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    accountNumberColumn: "",
    accountNameColumn: "",
    openingBalanceColumn: "",
    closingBalanceColumn: "",
    amountColumn: "",
    dateColumn: "",
    descriptionColumn: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (batch._fileContent) {
      const detected = detectHeadersFromBase64(batch._fileContent, batch.originalFilename);
      setHeaders(detected);
      if (detected.length > 0) {
        const lower = detected.map((h) => h.toLowerCase());
        const findCol = (...keywords: string[]) =>
          detected[lower.findIndex((h) => keywords.some((k) => h.includes(k)))] ?? "";
        setMapping({
          accountNumberColumn: findCol("konto", "account", "nr", "number"),
          accountNameColumn: findCol("namn", "name", "benämning", "description"),
          openingBalanceColumn: findCol("ingående", "opening", "ib", "in_bal"),
          closingBalanceColumn: findCol("utgående", "closing", "ub", "out_bal"),
          amountColumn: findCol("belopp", "amount", "debet", "kredit"),
          dateColumn: findCol("datum", "date"),
          descriptionColumn: findCol("text", "beskrivning", "desc"),
        });
      }
    }
  }, [batch._fileContent, batch.originalFilename]);

  const fields: ColumnField[] = [
    { key: "accountNumberColumn", labelKey: "colmap.account_number", required: true, stateKey: "accountNumberColumn" },
    { key: "accountNameColumn", labelKey: "colmap.account_name", required: false, stateKey: "accountNameColumn" },
    { key: "openingBalanceColumn", labelKey: "colmap.opening_balance", required: false, stateKey: "openingBalanceColumn" },
    { key: "closingBalanceColumn", labelKey: "colmap.closing_balance", required: false, stateKey: "closingBalanceColumn" },
    { key: "amountColumn", labelKey: "colmap.amount", required: false, stateKey: "amountColumn" },
    { key: "dateColumn", labelKey: "colmap.date", required: false, stateKey: "dateColumn" },
    { key: "descriptionColumn", labelKey: "colmap.description", required: false, stateKey: "descriptionColumn" },
  ];

  const handleSubmit = async () => {
    if (!mapping.accountNumberColumn) {
      setError(t("colmap.error.required"));
      return;
    }
    if (!batch._fileContent) {
      setError("Filinnehåll saknas. Försök ladda upp filen igen.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/imports/${batch.id}/column-mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          accountNumberColumn: mapping.accountNumberColumn,
          accountNameColumn: mapping.accountNameColumn || null,
          openingBalanceColumn: mapping.openingBalanceColumn || null,
          closingBalanceColumn: mapping.closingBalanceColumn || null,
          amountColumn: mapping.amountColumn || null,
          dateColumn: mapping.dateColumn || null,
          descriptionColumn: mapping.descriptionColumn || null,
          fileContent: batch._fileContent,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        onDone(updated);
      } else {
        const err = await res.json().catch(() => ({ message: "Fel vid parsning." }));
        setError(err.message ?? "Fel vid parsning.");
      }
    } catch {
      setError("Nätverksfel. Försök igen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("colmap.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("colmap.subtitle")}</p>
        <p className="text-xs text-muted-foreground font-mono mt-1">{batch.originalFilename}</p>
      </div>

      {headers.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Inga kolumnrubriker hittades i filen. Kontrollera att filen är i rätt format.
        </div>
      ) : (
        <>
          {/* Column preview */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">{t("colmap.preview")}</h3>
            <div className="flex flex-wrap gap-2">
              {headers.map((h) => (
                <span key={h} className="inline-flex items-center rounded border border-border bg-muted/30 px-2 py-0.5 text-xs font-mono text-foreground">
                  {h}
                </span>
              ))}
            </div>
          </div>

          {/* Mapping fields */}
          <div className="space-y-3">
            {fields.map((field) => (
              <div key={field.key} className="flex items-center gap-3">
                <div className="w-44 shrink-0">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    {t(field.labelKey as Parameters<typeof t>[0])}
                    {field.required ? (
                      <span className="text-xs text-red-500">*</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">({t("colmap.optional")})</span>
                    )}
                  </label>
                </div>
                <select
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={mapping[field.stateKey]}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [field.stateKey]: e.target.value }))}
                >
                  <option value="">{t("colmap.select")}</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button size="sm" onClick={handleSubmit} disabled={submitting || !mapping.accountNumberColumn}>
          {submitting ? (
            <><Loader2 className="size-3 mr-2 animate-spin" /> Analyserar...</>
          ) : (
            <><ArrowRight className="size-3 mr-2" /> {t("colmap.proceed")}</>
          )}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={submitting}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}
