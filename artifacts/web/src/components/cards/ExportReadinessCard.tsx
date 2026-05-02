import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Download } from "lucide-react";
import { LockedFeatureTooltip } from "@/components/badges/LockedFeatureTooltip";
import { useLanguage } from "@/contexts/LanguageContext";

export interface ReadinessItem {
  label: string;
  passed: boolean;
}

interface ExportReadinessCardProps {
  items: ReadinessItem[];
  isLocked?: boolean;
}

export function ExportReadinessCard({ items, isLocked = false }: ExportReadinessCardProps) {
  const { t } = useLanguage();
  const allPassed = items.every((i) => i.passed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("card.export.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              {item.passed ? (
                <CheckCircle2 className="size-4 text-green-500 shrink-0" />
              ) : (
                <XCircle className="size-4 text-red-500 shrink-0" />
              )}
              <span className={item.passed ? "text-foreground" : "text-foreground font-medium"}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        <div className="pt-4 border-t border-border">
          {isLocked ? (
            <LockedFeatureTooltip className="w-full block">
              <Button className="w-full gap-2 opacity-50 pointer-events-none" disabled={!allPassed}>
                <Download className="size-4" /> {t("card.export.button")}
              </Button>
            </LockedFeatureTooltip>
          ) : (
            <Button className="w-full gap-2" disabled={!allPassed}>
              <Download className="size-4" /> {t("card.export.button")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
