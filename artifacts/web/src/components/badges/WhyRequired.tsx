import { useState } from "react";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface WhyRequiredProps {
  reason: string;
}

export function WhyRequired({ reason }: WhyRequiredProps) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <HelpCircle className="size-3" />
        {t("expand.why_required")}
      </button>
      {open && (
        <div className="mt-1 ml-4 rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground border border-border">
          {reason}
        </div>
      )}
    </div>
  );
}
