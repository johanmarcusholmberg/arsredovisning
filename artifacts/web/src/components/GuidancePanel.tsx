import { useState, ReactNode } from "react";
import { HelpCircle, X, Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

interface GuidancePanelProps {
  children?: ReactNode;
}

export function GuidancePanel({ children }: GuidancePanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { t } = useLanguage();

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center size-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label={t("guidance.panel.open")}
        title={t("guidance.panel.open")}
      >
        <HelpCircle className="size-6" />
      </button>
    );
  }

  return (
    <aside className="w-64 shrink-0 border-l border-border bg-muted/10 hidden xl:flex flex-col h-full relative">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Info className="size-4 text-primary" />
          {t("guidance.panel.title")}
        </h3>
        <Button 
          variant="ghost" 
          size="icon" 
          className="size-7 -mr-2" 
          onClick={() => setIsOpen(false)}
          title={t("guidance.panel.close")}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="p-4 overflow-y-auto flex-1">
        {children || (
          <div className="text-sm text-muted-foreground italic">
            {t("guidance.panel.empty")}
          </div>
        )}
      </div>
    </aside>
  );
}
