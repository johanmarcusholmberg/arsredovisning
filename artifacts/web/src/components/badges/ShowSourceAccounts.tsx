import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ShowSourceAccountsProps {
  accounts: string[];
}

export function ShowSourceAccounts({ accounts }: ShowSourceAccountsProps) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {t("expand.source_accounts")} ({accounts.length})
      </button>
      {open && (
        <div className="mt-1 ml-4 rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground border border-border">
          <ul className="space-y-0.5">
            {accounts.map((acc) => (
              <li key={acc} className="font-mono">{acc}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
