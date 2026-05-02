import { LockedFeatureTooltip } from "@/components/badges/LockedFeatureTooltip";
import { ManualOverridePlaceholder } from "@/components/badges/ManualOverridePlaceholder";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { FileText, FileDown } from "lucide-react";

export function ExportSection() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-2">{t("demo.export.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("demo.export.notice")}</p>
      </div>

      {/* Document preview with watermark */}
      <div className="relative rounded-xl border border-border bg-muted/10 overflow-hidden" style={{ minHeight: "380px" }}>
        <div className="p-6">
          <div className="max-w-md mx-auto space-y-4 opacity-30">
            <div className="text-center space-y-1">
              <div className="h-5 bg-foreground/20 rounded w-48 mx-auto" />
              <div className="h-4 bg-foreground/10 rounded w-32 mx-auto" />
              <div className="h-3 bg-foreground/10 rounded w-40 mx-auto" />
            </div>
            <div className="border-t border-border pt-4 space-y-2">
              <div className="h-3 bg-foreground/10 rounded w-full" />
              <div className="h-3 bg-foreground/10 rounded w-5/6" />
              <div className="h-3 bg-foreground/10 rounded w-4/6" />
              <div className="h-3 bg-foreground/10 rounded w-full" />
              <div className="h-3 bg-foreground/10 rounded w-3/4" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-3 bg-foreground/10 rounded w-40" />
                  <div className="h-3 bg-foreground/10 rounded w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* DEMO watermark overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="text-8xl font-black text-primary/10 select-none"
            style={{ transform: "rotate(-25deg)", letterSpacing: "0.15em" }}
          >
            DEMO
          </div>
        </div>
      </div>

      {/* Export buttons */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t("demo.export.options")}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <LockedFeatureTooltip>
            <Button variant="outline" className="w-full gap-2 pointer-events-none" disabled>
              <FileDown className="size-4" />
              {t("demo.export.pdf")}
            </Button>
          </LockedFeatureTooltip>
          <LockedFeatureTooltip>
            <Button variant="outline" className="w-full gap-2 pointer-events-none" disabled>
              <FileText className="size-4" />
              {t("demo.export.word")}
            </Button>
          </LockedFeatureTooltip>
        </div>
      </div>

      {/* Manual override placeholder */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">{t("demo.export.manual.title")}</h3>
        <ManualOverridePlaceholder />
      </div>
    </div>
  );
}
