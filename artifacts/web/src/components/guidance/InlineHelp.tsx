import { useState, ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface InlineHelpProps {
  label: string;
  children: ReactNode;
}

export function InlineHelp({ label, children }: InlineHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {label}
      </button>
      {open && (
        <div className="mt-1.5 ml-4 rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground border border-border">
          {children}
        </div>
      )}
    </div>
  );
}
