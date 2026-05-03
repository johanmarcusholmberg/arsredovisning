import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md mx-4 shadow-lg">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-8 w-8 text-destructive shrink-0 mt-0.5" />
            <h1 className="text-2xl font-bold">{t("notfound.title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t("notfound.body")}</p>
          <Button asChild>
            <Link href="/">{t("notfound.home")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
