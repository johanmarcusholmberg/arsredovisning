import { useLanguage } from "@/hooks/useLanguage";
import { InlineHelp } from "./InlineHelp";

interface BASLogicExpanderProps {
  logicText: string;
}

export function BASLogicExpander({ logicText }: BASLogicExpanderProps) {
  const { t } = useLanguage();
  
  return (
    <InlineHelp label={t("bas.logic.label")}>
      <div className="font-mono text-[11px] leading-relaxed">
        {logicText}
      </div>
    </InlineHelp>
  );
}
