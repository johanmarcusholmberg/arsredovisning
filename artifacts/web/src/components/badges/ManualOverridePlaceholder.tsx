import { Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function ManualOverridePlaceholder() {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-2 rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-400 cursor-not-allowed">
      <Lock className="size-3.5 shrink-0" />
      <span>{t("placeholder.manual_override")}</span>
    </div>
  );
}
