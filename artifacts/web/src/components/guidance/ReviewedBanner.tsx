import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReviewedBannerProps {
  reviewerName: string;
  timestamp: string;
}

export function ReviewedBanner({ reviewerName, timestamp }: ReviewedBannerProps) {
  const { t } = useLanguage();
  
  return (
    <div className="inline-flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-1.5">
      <CheckCircle2 className="size-3.5 text-green-600" />
      <span className="text-xs font-medium text-green-800">{t("review.reviewed.label")}</span>
      <span className="text-xs text-green-600 mx-1">•</span>
      <span className="text-xs text-green-700">{reviewerName}, {timestamp}</span>
    </div>
  );
}
