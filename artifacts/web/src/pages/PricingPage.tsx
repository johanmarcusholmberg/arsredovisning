import { Check, ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * initiateCheckout — placeholder for Stripe Checkout integration.
 * TODO (Phase 4): Replace with real Stripe Checkout session creation.
 * Example:
 *   const res = await fetch("/api/checkout/create-session", { method: "POST", ... });
 *   const { url } = await res.json();
 *   window.location.href = url;
 */
export function initiateCheckout(_priceId: string) {
  alert("Stripe Checkout inte konfigurerat ännu. Implementeras i Fas 4.");
}

export default function PricingPage() {
  const { t } = useLanguage();

  const features1 = [
    t("pricing.card1.feature1"),
    t("pricing.card1.feature2"),
    t("pricing.card1.feature3"),
    t("pricing.card1.feature4"),
  ];

  const features2 = [
    t("pricing.card2.feature1"),
    t("pricing.card2.feature2"),
    t("pricing.card2.feature3"),
    t("pricing.card2.feature4"),
  ];

  const includedItems = [
    t("pricing.includes.1"),
    t("pricing.includes.2"),
    t("pricing.includes.3"),
    t("pricing.includes.4"),
    t("pricing.includes.5"),
    t("pricing.includes.6"),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-foreground">{t("pricing.title")}</h1>
        <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
          {t("pricing.subtitle")}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Card 1: Pay per report */}
        <div className="rounded-xl border-2 border-primary bg-card shadow-md overflow-hidden">
          <div className="bg-primary/5 px-6 py-5 border-b border-primary/20">
            <h2 className="text-lg font-bold text-foreground">{t("pricing.card1.title")}</h2>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">{t("pricing.card1.price")}</span>
              <span className="text-sm text-muted-foreground">{t("pricing.card1.unit")}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("pricing.card1.detail")}</p>
          </div>
          <div className="px-6 py-5">
            <ul className="space-y-3 mb-6">
              {features1.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check className="size-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              className="w-full gap-2"
              onClick={() => initiateCheckout("price_per_report")}
            >
              {t("pricing.card1.cta")}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Card 2: Subscription — coming soon */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden opacity-60">
          <div className="bg-muted/30 px-6 py-5 border-b border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-muted-foreground">{t("pricing.card2.title")}</h2>
              <span className="text-xs rounded-full bg-muted border border-border px-2 py-0.5 text-muted-foreground">
                {t("pricing.card2.coming_soon")}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-muted-foreground">—</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("pricing.card2.detail")}</p>
          </div>
          <div className="px-6 py-5">
            <ul className="space-y-3 mb-6">
              {features2.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Lock className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            <Button className="w-full" variant="outline" disabled>
              {t("pricing.card2.cta")}
            </Button>
          </div>
        </div>
      </div>

      {/* What payment unlocks */}
      <div className="mt-10 max-w-3xl mx-auto rounded-xl border border-border bg-muted/20 px-6 py-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          {t("pricing.includes.title")}
        </h3>
        <ul className="grid sm:grid-cols-2 gap-2">
          {includedItems.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-foreground">
              <Check className="size-3.5 text-primary shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
