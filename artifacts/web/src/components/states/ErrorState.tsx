import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

interface ErrorStateProps {
  messageSv?: string;
  messageEn?: string;
  onRetry?: () => void;
}

export function ErrorState({ messageSv, messageEn, onRetry }: ErrorStateProps) {
  const { t, language } = useLanguage();
  
  const defaultMsgSv = t("state.error.desc");
  const defaultMsgEn = "Could not load data. Try again.";
  
  const msgSv = messageSv || defaultMsgSv;
  const msgEn = messageEn || defaultMsgEn;
  const message = language === "en" ? msgEn : msgSv;

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border border-red-100 rounded-lg bg-red-50/50 min-h-[200px]">
      <AlertTriangle className="size-8 text-red-500 mb-4" />
      <h3 className="text-sm font-medium text-red-900 mb-1">{t("state.error.title")}</h3>
      <p className="text-sm text-red-700 max-w-sm mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 border-red-200 text-red-700 hover:bg-red-100 hover:text-red-900">
          <RefreshCcw className="size-3.5" />
          {t("state.error.retry")}
        </Button>
      )}
    </div>
  );
}
