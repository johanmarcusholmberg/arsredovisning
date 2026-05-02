import { Card, CardContent } from "@/components/ui/card";
import { DemoDataBadge } from "@/components/badges/DemoDataBadge";
import { useLanguage } from "@/hooks/useLanguage";

export function DemoDataCard() {
  const { t } = useLanguage();
  return (
    <Card className="bg-amber-50/50 border-amber-200">
      <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <DemoDataBadge />
        <p className="text-sm text-amber-800 flex-1">{t("demo.guidance.text")}</p>
      </CardContent>
    </Card>
  );
}
