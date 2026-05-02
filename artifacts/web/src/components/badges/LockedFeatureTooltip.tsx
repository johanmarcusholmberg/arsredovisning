import { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LockedFeatureTooltipProps {
  children: ReactNode;
  className?: string;
}

export function LockedFeatureTooltip({ children, className = "" }: LockedFeatureTooltipProps) {
  const { t } = useLanguage();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`relative ${className}`}>
          <div className="pointer-events-none select-none opacity-50">{children}</div>
          <div className="absolute inset-0 flex items-center justify-center cursor-not-allowed">
            <div className="bg-white/80 rounded-full p-1 shadow-sm border border-gray-200">
              <Lock className="size-3 text-gray-500" />
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span>{t("badge.locked.tooltip")}</span>
      </TooltipContent>
    </Tooltip>
  );
}
