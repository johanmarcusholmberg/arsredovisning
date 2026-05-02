import { Info, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/hooks/useLanguage";

export function DemoGuidanceBanner() {
  const { t } = useLanguage();
  
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
      <div className="flex items-center gap-2.5 text-blue-800">
        <Info className="size-4 shrink-0" />
        <p className="text-sm">{t("demo.guidance.text")}</p>
      </div>
      <Link href="/pricing" className="shrink-0 flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors">
        {t("demo.guidance.cta")} <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
