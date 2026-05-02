import { FileSearch } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function ParseSpinnerState() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-border rounded-lg bg-card">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
        <div className="relative bg-background border border-primary/20 p-4 rounded-full shadow-sm">
          <FileSearch className="size-8 text-primary animate-pulse" />
        </div>
      </div>
      <h3 className="text-base font-medium text-foreground mb-2">{t("state.parse.analyzing")}</h3>
      <p className="text-sm text-muted-foreground max-w-[250px]">
        Vi extraherar konton och verifikationer från din SIE-fil...
      </p>
    </div>
  );
}
