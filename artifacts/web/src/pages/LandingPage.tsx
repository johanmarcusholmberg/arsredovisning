import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  FileUp, GitBranch, LayoutTemplate, BarChart2,
  FileText, ShieldCheck, Users, Download, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

const workflowStepKeys = [
  "landing.steps.1",
  "landing.steps.2",
  "landing.steps.3",
  "landing.steps.4",
  "landing.steps.5",
  "landing.steps.6",
  "landing.steps.7",
  "landing.steps.8",
] as const;

const workflowIcons = [FileUp, GitBranch, LayoutTemplate, BarChart2, FileText, ShieldCheck, Users, Download];

const compliancePointKeys = [
  "landing.compliance.point1",
  "landing.compliance.point2",
  "landing.compliance.point3",
  "landing.compliance.point4",
] as const;

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export default function LandingPage() {
  const { t } = useLanguage();

  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" as const }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary mb-6">
              {t("landing.badge")}
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
              {t("landing.title")}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              {t("landing.subtitle")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/demo">
                <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
                  {t("landing.cta.demo")}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  {t("landing.cta.start")}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 8-step workflow */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {t("landing.workflow.title")}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            {t("landing.workflow.subtitle")}
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {workflowStepKeys.map((key, index) => {
            const Icon = workflowIcons[index];
            return (
              <motion.div
                key={key}
                variants={cardVariants}
                className="relative rounded-lg border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 size-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("landing.step")} {index + 1}
                    </p>
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {t(key).replace(/^\d+\.\s*/, "")}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* Trust / compliance section */}
      <section className="border-t border-border bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {t("landing.compliance.title")}
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                {t("landing.trust")}
              </p>
              <div className="mt-6 space-y-3">
                {compliancePointKeys.map((key) => (
                  <div key={key} className="flex items-start gap-2.5">
                    <ShieldCheck className="size-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground">{t(key)}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="rounded-lg border border-amber-200 bg-amber-50 p-5"
            >
              <p className="text-sm font-semibold text-amber-900 mb-2">
                {t("landing.notice.title")}
              </p>
              <p className="text-sm text-amber-800 leading-relaxed">
                {t("landing.notice")}
              </p>
              <p className="text-xs text-amber-700 mt-3">
                {t("landing.notice.footer")}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA bottom */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="rounded-xl border border-border bg-card p-10 text-center"
        >
          <h2 className="text-2xl font-bold text-foreground">
            {t("landing.cta.section.title")}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto">
            {t("landing.cta.section.subtitle")}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/demo">
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2">
                {t("landing.cta.demo")}
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                {t("landing.cta.start")}
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
