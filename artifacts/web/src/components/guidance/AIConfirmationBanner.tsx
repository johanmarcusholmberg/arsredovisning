import { AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { LockedFeatureTooltip } from "@/components/badges/LockedFeatureTooltip";

interface AIConfirmationBannerProps {
  confidence?: "high" | "medium" | "low";
  isLocked?: boolean;
}

export function AIConfirmationBanner({ confidence = "medium", isLocked = false }: AIConfirmationBannerProps) {
  const { t } = useLanguage();
  
  const confidenceColor = 
    confidence === "high" ? "bg-green-500" : 
    confidence === "medium" ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="size-4 text-amber-600 shrink-0" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="text-sm font-medium text-amber-900">{t("ai.suggestion.banner")}</span>
          <div className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${confidenceColor}`} />
            <span className="text-xs text-amber-700">
              {t(`confidence.${confidence}` as Parameters<typeof t>[0])}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex gap-2 shrink-0">
        {isLocked ? (
          <LockedFeatureTooltip>
             <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 bg-white opacity-50 pointer-events-none">
                  <X className="size-3.5 mr-1.5" /> {t("ai.suggestion.reject")}
                </Button>
                <Button size="sm" className="h-8 bg-amber-600 hover:bg-amber-700 text-white opacity-50 pointer-events-none">
                  <Check className="size-3.5 mr-1.5" /> {t("ai.suggestion.confirm")}
                </Button>
             </div>
          </LockedFeatureTooltip>
        ) : (
          <>
            <Button variant="outline" size="sm" className="h-8 bg-white border-amber-300 text-amber-800 hover:bg-amber-100">
              <X className="size-3.5 mr-1.5" /> {t("ai.suggestion.reject")}
            </Button>
            <Button size="sm" className="h-8 bg-amber-600 hover:bg-amber-700 text-white">
              <Check className="size-3.5 mr-1.5" /> {t("ai.suggestion.confirm")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
