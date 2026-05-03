import { useEffect, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  FileText,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * Looping hero animation: SIE upload → account mapping → validation → ready.
 * Four "scenes" cycle every ~9s. Honours prefers-reduced-motion (renders the
 * final scene statically). Visuals reuse the same chrome as DemoSlideVisuals
 * so the look stays consistent with /demo.
 */
const SCENE_MS = 2400;
const TOTAL_SCENES = 4;

type Scene = 0 | 1 | 2 | 3;

const mappingRows = [
  { acc: "3001", name: "Nettoomsättning" },
  { acc: "1930", name: "Bank" },
  { acc: "2440", name: "Leverantörsskulder" },
  { acc: "2611", name: "Utgående moms" },
];

export function HeroAnimation() {
  const { t } = useLanguage();
  const reduce = useReducedMotion();
  const [scene, setScene] = useState<Scene>(reduce ? 3 : 0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setScene((s) => ((s + 1) % TOTAL_SCENES) as Scene);
    }, SCENE_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div
      role="img"
      aria-label={t("landing.hero.animation.aria")}
      className="relative w-full max-w-md mx-auto"
    >
      {/* Soft glow underlay */}
      <div className="absolute -inset-6 rounded-3xl bg-gradient-to-tr from-primary/10 via-primary/5 to-transparent blur-2xl pointer-events-none" />

      <div className="relative rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
        {/* Faux browser chrome */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/40">
          <span className="size-2.5 rounded-full bg-red-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
          <div className="ml-3 h-4 flex-1 rounded bg-background/70 border border-border/60" />
        </div>

        {/* Stage — fixed height so cards don't shift the layout */}
        <div className="relative h-[320px] sm:h-[340px] p-4">
          <AnimatePresence mode="wait">
            {scene === 0 && <SceneUpload key="upload" />}
            {scene === 1 && <SceneMapping key="mapping" />}
            {scene === 2 && <SceneValidate key="validate" />}
            {scene === 3 && <SceneReady key="ready" t={t} />}
          </AnimatePresence>
        </div>

        {/* Scene dots */}
        <div className="flex items-center justify-center gap-1.5 pb-3">
          {Array.from({ length: TOTAL_SCENES }).map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === scene ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

function SceneUpload() {
  return (
    <motion.div {...fadeUp} className="space-y-3">
      <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              nordic_design_2024.se
            </p>
            <p className="text-xs text-muted-foreground">SIE 4 · 142 KB</p>
          </div>
          <Loader2 className="size-4 text-primary animate-spin" />
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
        <p className="text-xs text-muted-foreground">
          Importerar verifikationer …
        </p>
      </div>
    </motion.div>
  );
}

function SceneMapping() {
  return (
    <motion.div {...fadeUp} className="space-y-2">
      <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
        Kontomappning · BAS 2024
      </p>
      {mappingRows.map((row, i) => (
        <motion.div
          key={row.acc}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.18, duration: 0.32 }}
          className="flex items-center gap-2 text-sm rounded-lg border border-border bg-background px-3 py-2 shadow-sm"
        >
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {row.acc}
          </span>
          <ArrowRight className="size-3 text-muted-foreground shrink-0" />
          <span className="text-foreground truncate">{row.name}</span>
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.18 + 0.18, type: "spring", stiffness: 400, damping: 18 }}
            className="ml-auto"
          >
            <CheckCircle2 className="size-4 text-emerald-600" />
          </motion.span>
        </motion.div>
      ))}
    </motion.div>
  );
}

function SceneValidate() {
  const checks = [
    "Balansräkning balanserar",
    "Obligatoriska noter ifyllda",
    "Resultaträkning · K3-format",
    "Kassaflöde — indirekt metod",
  ];
  return (
    <motion.div {...fadeUp} className="space-y-2.5">
      {checks.map((label, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.22, duration: 0.3 }}
          className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"
        >
          <motion.span
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: i * 0.22 + 0.1, type: "spring", stiffness: 380, damping: 18 }}
            className="inline-flex"
          >
            <CheckCircle2 className="size-4 text-emerald-600" />
          </motion.span>
          <span className="text-sm text-emerald-900">{label}</span>
        </motion.div>
      ))}
    </motion.div>
  );
}

function SceneReady({ t }: { t: (k: string) => string }) {
  return (
    <motion.div {...fadeUp} className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="size-4 text-emerald-600" />
        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
          {t("landing.hero.animation.ready")}
        </p>
      </div>

      {/* Stacked report-page mockup */}
      <div className="relative flex-1">
        <motion.div
          initial={{ opacity: 0, y: 10, rotate: -1 }}
          animate={{ opacity: 1, y: 0, rotate: -3 }}
          transition={{ delay: 0.05, duration: 0.4 }}
          className="absolute inset-x-4 top-2 rounded-lg border border-border bg-background p-3 shadow-md"
        >
          <ReportRows shaded />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, rotate: 1.5 }}
          transition={{ delay: 0.18, duration: 0.4 }}
          className="absolute inset-x-1 top-6 rounded-lg border border-border bg-background p-3 shadow-lg"
        >
          <ReportRows />
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
            <Sparkles className="size-3" />
            Nordic Design AB · 2024
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function ReportRows({ shaded = false }: { shaded?: boolean }) {
  const tone = shaded ? "bg-muted/60" : "bg-muted";
  return (
    <div className="space-y-1.5">
      <div className={`h-2 rounded ${tone} w-3/5`} />
      <div className={`h-2 rounded ${tone} w-4/5`} />
      <div className={`h-2 rounded ${tone} w-2/3`} />
      <div className="h-px bg-border my-1.5" />
      <div className={`h-2 rounded ${tone} w-1/2`} />
      <div className={`h-2 rounded ${tone} w-3/4`} />
      <div className={`h-2 rounded ${tone} w-2/5`} />
    </div>
  );
}
