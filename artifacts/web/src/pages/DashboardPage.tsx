import { Link } from "wouter";
import { ArrowRight, Lock, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { DemoDataBadge } from "@/components/badges/DemoDataBadge";
import { LockedFeatureTooltip } from "@/components/badges/LockedFeatureTooltip";

export default function DashboardPage() {
  const { t } = useLanguage();

  const recentActivity = [
    { label: t("dashboard.activity.1"), time: t("dashboard.activity.time.recent") },
    { label: t("dashboard.activity.2"), time: t("dashboard.activity.time.today") },
    { label: t("dashboard.activity.3"), time: t("dashboard.activity.time.today") },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Subscription status bar */}
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4">
        <p className="text-sm text-amber-800">
          {t("dashboard.subscription.notice")}
        </p>
        <Link href="/pricing">
          <Button variant="outline" size="sm" className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100">
            {t("dashboard.subscription.cta")} <ArrowRight className="size-3 ml-1" />
          </Button>
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-6">{t("dashboard.title")}</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Demo workspace card */}
        <div className="rounded-xl border border-green-200 bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-green-100 bg-green-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-green-600" />
              <span className="text-sm font-semibold text-green-800">
                {t("dashboard.demo_card.header")}
              </span>
            </div>
            <DemoDataBadge />
          </div>
          <div className="p-5">
            <h3 className="font-semibold text-foreground">{t("dashboard.demo_card.title")}</h3>
            <p className="text-xs text-muted-foreground mt-1">{t("dashboard.demo_card.meta")}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">
                <CheckCircle2 className="size-3" /> {t("dashboard.demo_card.import_done")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">
                <CheckCircle2 className="size-3" /> {t("dashboard.demo_card.mapping_done")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">
                <AlertTriangle className="size-3" /> {t("dashboard.demo_card.validation_warning")}
              </span>
            </div>

            <div className="mt-5 space-y-2">
              <Link href="/demo">
                <Button className="w-full gap-2">
                  {t("dashboard.demo_card.open")}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/demo/example">
                <Button variant="outline" className="w-full gap-2">
                  {t("demo.export.example.cta")}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Locked real project card */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden opacity-75">
          <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground">
                {t("dashboard.real_card.header")}
              </span>
            </div>
            <span className="text-xs rounded-full bg-muted border border-border px-2 py-0.5 text-muted-foreground">
              {t("dashboard.real_card.requires_payment")}
            </span>
          </div>
          <div className="p-5">
            <h3 className="font-semibold text-muted-foreground">{t("dashboard.real_card.title")}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t("dashboard.real_card.description")}
            </p>

            <div className="mt-4 rounded-lg bg-muted/30 border border-dashed border-border p-4 text-center">
              <Lock className="size-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t("dashboard.real_card.price")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("dashboard.real_card.price_detail")}</p>
            </div>

            <div className="mt-5">
              <Link href="/workspace">
                <Button className="w-full gap-2 pointer-events-auto">
                  {t("dashboard.real_card.cta")}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="sm" variant="ghost" className="w-full mt-2 text-primary">
                  {t("dashboard.real_card.pricing_link")} <ArrowRight className="size-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity + notifications */}
      <div className="mt-6 grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            {t("dashboard.activity.title")}
          </h2>
          <ul className="space-y-3">
            {recentActivity.map((item, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            {t("dashboard.notifications.title")}
          </h2>
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
            <p className="text-sm text-blue-800">
              {t("dashboard.notifications.cta")}{" "}
              <Link href="/pricing" className="underline font-medium">
                {t("dashboard.notifications.cta_link")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
