import { demoData } from "@/data/demoData";
import { LockedFeatureTooltip } from "@/components/badges/LockedFeatureTooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileUp, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImportSection() {
  const { t } = useLanguage();
  const { importSummary } = demoData;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-green-200 bg-green-50/50 p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="size-5 text-green-600" />
          <h2 className="text-base font-semibold text-green-800">{t("demo.import.done.title")}</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t("demo.import.filename")}</p>
            <p className="font-medium text-foreground mt-0.5 font-mono text-xs">{importSummary.filename}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("demo.import.status")}</p>
            <p className="font-medium text-green-700 mt-0.5 capitalize">{importSummary.status}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("demo.import.accounts")}</p>
            <p className="font-medium text-foreground mt-0.5">{importSummary.accountsCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("demo.import.transactions")}</p>
            <p className="font-medium text-foreground mt-0.5">{importSummary.transactionsCount.toLocaleString("sv-SE")}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">{t("demo.import.period")}</p>
            <p className="font-medium text-foreground mt-0.5">{importSummary.period}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">{t("demo.import.upload.title")}</h3>
        <LockedFeatureTooltip>
          <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-10 text-center">
            <FileUp className="size-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{t("demo.import.upload.drag")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("demo.import.upload.or")}</p>
            <Button variant="outline" size="sm" className="mt-3" disabled>
              {t("demo.import.upload.btn")}
            </Button>
            <p className="text-xs text-muted-foreground mt-3">{t("demo.import.upload.formats")}</p>
          </div>
        </LockedFeatureTooltip>
      </div>
    </div>
  );
}
