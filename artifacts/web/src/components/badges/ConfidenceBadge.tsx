import { useLanguage } from "@/hooks/useLanguage";

type Confidence = "high" | "medium" | "low";

const configs: Record<Confidence, { bg: string; text: string; border: string; dot: string }> = {
  high: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  low: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const { t } = useLanguage();
  const { bg, text, border, dot } = configs[confidence];
  const labelKey = `confidence.${confidence}` as Parameters<typeof t>[0];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${bg} ${text} ${border}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {t(labelKey)}
    </span>
  );
}
