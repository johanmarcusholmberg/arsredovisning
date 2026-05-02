import { useLanguage } from "@/contexts/LanguageContext";

export function DemoDataBadge({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-xs font-medium text-amber-800 ${className}`}
    >
      <span className="size-1.5 rounded-full bg-amber-500 inline-block" />
      {t("badge.demo_data")}
    </span>
  );
}
