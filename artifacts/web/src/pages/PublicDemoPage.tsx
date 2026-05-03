import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { DemoCarousel, type DemoSlideDefinition } from "@/components/demo/DemoCarousel";
import {
  ImportVisual,
  StatementsVisual,
  CashFlowVisual,
  NotesVisual,
  FinishedVisual,
} from "@/components/demo/DemoSlideVisuals";

const APP_SIGNUP_URL = "/arsredovisningar/register";

export default function PublicDemoPage() {
  const { t } = useLanguage();

  const slides: DemoSlideDefinition[] = [
    {
      key: "import",
      title: t("publicDemo.slides.import.title"),
      subtitle: t("publicDemo.slides.import.subtitle"),
      body: t("publicDemo.slides.import.body"),
      visual: <ImportVisual />,
    },
    {
      key: "statements",
      title: t("publicDemo.slides.statements.title"),
      subtitle: t("publicDemo.slides.statements.subtitle"),
      body: t("publicDemo.slides.statements.body"),
      visual: <StatementsVisual />,
    },
    {
      key: "cashflow",
      title: t("publicDemo.slides.cashflow.title"),
      subtitle: t("publicDemo.slides.cashflow.subtitle"),
      body: t("publicDemo.slides.cashflow.body"),
      visual: <CashFlowVisual />,
    },
    {
      key: "notes",
      title: t("publicDemo.slides.notes.title"),
      subtitle: t("publicDemo.slides.notes.subtitle"),
      body: t("publicDemo.slides.notes.body"),
      visual: <NotesVisual />,
    },
    {
      key: "finished",
      title: t("publicDemo.slides.finished.title"),
      subtitle: t("publicDemo.slides.finished.subtitle"),
      body: t("publicDemo.slides.finished.body"),
      visual: <FinishedVisual />,
    },
  ];

  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" as const }}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-medium text-amber-800 mb-5">
              {t("publicDemo.hero.badge")}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-tight">
              {t("publicDemo.hero.title")}
            </h1>
            <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
              {t("publicDemo.hero.subtitle")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Carousel */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <DemoCarousel slides={slides} />
      </section>

      {/* CTA / Download row */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-12 md:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-border bg-card p-6 md:p-10"
        >
          <div className="grid md:grid-cols-[1fr_auto] gap-6 md:gap-10 items-center">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-foreground">
                {t("publicDemo.cta.title")}
              </h2>
              <p className="mt-2 text-sm md:text-base text-muted-foreground leading-relaxed">
                {t("publicDemo.cta.subtitle")}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 md:items-stretch">
              <Button asChild size="lg" className="gap-2">
                <a href={APP_SIGNUP_URL} target="_top" rel="noopener">
                  {t("publicDemo.cta.start")}
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>
          </div>
        </motion.div>

        <p className="mt-6 text-center text-xs text-muted-foreground max-w-xl mx-auto">
          {t("publicDemo.disclaimer")}
        </p>
      </section>
    </div>
  );
}
