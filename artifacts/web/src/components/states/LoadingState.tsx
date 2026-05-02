import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";

interface LoadingStateProps {
  labelSv?: string;
  labelEn?: string;
}

export function LoadingState({ labelSv = "Laddar...", labelEn = "Loading..." }: LoadingStateProps) {
  const { language } = useLanguage();
  const label = language === "en" ? labelEn : labelSv;

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    </div>
  );
}
