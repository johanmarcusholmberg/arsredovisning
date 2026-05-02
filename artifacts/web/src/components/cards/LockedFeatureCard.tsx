import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useLanguage } from "@/hooks/useLanguage";

interface LockedFeatureCardProps {
  title: string;
  description: string;
}

export function LockedFeatureCard({ title, description }: LockedFeatureCardProps) {
  const { t } = useLanguage();
  return (
    <Card className="bg-muted/30 border-dashed">
      <CardContent className="flex flex-col items-center justify-center p-8 text-center">
        <div className="rounded-full bg-muted p-3 mb-4">
          <Lock className="size-6 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">{description}</p>
        <span className="inline-block rounded-full bg-muted border border-border px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
          {t("locked.guidance.text")}
        </span>
        <Link href="/pricing">
          <Button variant="outline" size="sm">{t("locked.guidance.cta")}</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
