import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ShieldCheck,
  FileCheck2,
  ArrowRight,
  KeyRound,
} from "lucide-react";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * /upgrade — the project-license landing page.
 *
 * Shown when:
 *   - A free user tries to enter /companies/new, /companies/:id or
 *     any /reports/:reportId/* route (handled by <RequirePaid />).
 *   - The user manually navigates here from the demo-account card or
 *     sidebar.
 *
 * Stripe is not yet wired. Until then we explain the model (one
 * project license = one company + one fiscal year + one report) and
 * ask the user to contact the team to be granted access manually.
 */
export function Upgrade() {
  const { t } = useLanguage();
  const { isPaid, isAdmin } = useEntitlement();

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8 animate-in fade-in duration-300">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("upgrade.title")}
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          {t("upgrade.subtitle")}
        </p>
      </div>

      {isPaid && (
        <Card className="border-green-200 bg-green-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <ShieldCheck className="h-5 w-5" />
              {t("upgrade.has_access.title")}
            </CardTitle>
            <CardDescription className="text-green-900/80">
              {isAdmin
                ? t("upgrade.has_access.admin")
                : t("upgrade.has_access.body")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">
                {t("upgrade.has_access.cta")}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-primary" />
              {t("upgrade.included.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• {t("upgrade.included.company")}</p>
            <p>• {t("upgrade.included.year")}</p>
            <p>• {t("upgrade.included.report")}</p>
            <p>• {t("upgrade.included.editing")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("upgrade.try.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>{t("upgrade.try.body")}</p>
            <Button variant="outline" asChild>
              <a href="/demo">{t("upgrade.try.cta")}</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {!isPaid && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>{t("upgrade.request.title")}</CardTitle>
            <CardDescription>{t("upgrade.request.body")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="mailto:hello@example.com?subject=Begär%20projektlicens">
                {t("upgrade.request.cta")}
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
