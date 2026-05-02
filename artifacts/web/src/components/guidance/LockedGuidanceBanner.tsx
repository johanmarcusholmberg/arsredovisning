import { Lock, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/hooks/useLanguage";

export function LockedGuidanceBanner() {
  const { t } = useLanguage();
  
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 border border-dashed border-border px-4 py-3">
      <div className="flex items-center gap-2.5 text-muted-foreground">
        <Lock className="size-4 shrink-0" />
        <p className="text-sm">{t("locked.guidance.text")}</p>
      </div>
      <Link href="/pricing" className="shrink-0 flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors">
        {t("locked.guidance.cta")} <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
