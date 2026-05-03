import { useEffect, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  FileText,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Loader2,
  BookOpen,
  Download,
  PenLine,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * Looping hero animation walking through the user's natural journey:
 * 1. Upload SIE     — "I dropped a file in"
 * 2. Mapping        — "It understood my chart of accounts"
 * 3. Validate       — "It checked my work"
 * 4. Statements     — "I see real numbers in my report"
 * 5. Ready          — "Sign + export — I'm done"
 *
 * Honours prefers-reduced-motion (renders the final scene statically).
 * Visuals reuse the same chrome as DemoSlideVisuals so the look stays
 * consistent with /demo.
 */
const SCENE_MS = 3400;
const TOTAL_SCENES = 5;

type Scene = 0 | 1 | 2 | 3 | 4;

const mappingRows = [
  { acc: "3001", name: "Nettoomsättning" },
  { acc: "1930", name: "Bank" },
  { acc: "2440", name: "Leverantörsskulder" },
  { acc: "2611", name: "Utgående moms" },
];

export function HeroAnimation() {
  const { t } = useLanguage();
  const reduce = useReducedMotion();
  const [scene, setScene] = useState<Scene>(reduce ? 4 : 0);

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
        {/* Product header — neutral, no macOS traffic lights */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
          <div className="size-5 rounded bg-primary/10 flex items-center justify-center">
            <BookOpen className="size-3 text-primary" />
          </div>
          <p className="text-xs font-medium text-foreground">
            Nordic Design AB
          </p>
          <span className="text-xs text-muted-foreground">·</span>
          <p className="text-xs font-mono text-muted-foreground tabular-nums">
            2024
          </p>
          <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            K3
          </span>
        </div>

        {/* Stage — fixed height so cards don't shift the layout */}
        <div className="relative h-[320px] sm:h-[340px] p-4">
          <AnimatePresence mode="wait">
            {scene === 0 && <SceneUpload key="upload" />}
            {scene === 1 && <SceneMapping key="mapping" />}
            {scene === 2 && <SceneValidate key="validate" />}
            {scene === 3 && <SceneStatements key="statements" />}
            {scene === 4 && <SceneReady key="ready" t={t} />}
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

function fmt(n: number) {
  return n.toLocaleString("sv-SE").replace(/,/g, " ");
}

const incomeRows: { name: string; amount: number; bold?: boolean }[] = [
  { name: "Nettoomsättning", amount: 8420000 },
  { name: "Personalkostnader", amount: -3120000 },
  { name: "Avskrivningar", amount: -410000 },
  { name: "Övriga kostnader", amount: -3650000 },
  { name: "Rörelseresultat", amount: 1240000, bold: true },
];

function SceneStatements() {
  return (
    <motion.div {...fadeUp} className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-mono uppercase tracking-wider px-2 py-0.5">
          Resultaträkning
        </span>
        <span className="text-[10px] text-muted-foreground">2024 · kr</span>
      </div>

      <div className="rounded-xl border border-border bg-background p-3 shadow-sm space-y-1">
        {incomeRows.map((row, i) => (
          <motion.div
            key={row.name}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12, duration: 0.28 }}
            className={`grid grid-cols-[1fr_auto] items-baseline gap-x-3 text-[12px] ${
              row.bold
                ? "font-semibold text-foreground border-t border-border pt-1.5 mt-1"
                : "text-foreground"
            }`}
          >
            <span className="truncate">{row.name}</span>
            <span
              className={`text-right tabular-nums ${
                row.amount < 0 && !row.bold ? "text-muted-foreground" : ""
              }`}
            >
              {fmt(row.amount)}
            </span>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: incomeRows.length * 0.12 + 0.05, duration: 0.3 }}
        className="mt-2 inline-flex items-center gap-1.5 self-start text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"
      >
        <CheckCircle2 className="size-3" />
        Avstämt mot SIE
      </motion.div>
    </motion.div>
  );
}

function SceneReady({ t }: { t: (k: string) => string }) {
  const kpis = [
    { label: "Nettoomsättning", value: 8420000, prev: 7180000 },
    { label: "Rörelseresultat", value: 1240000, prev: 1015000 },
    { label: "Årets resultat", value: 887000, prev: 712000 },
  ];
  return (
    <motion.div {...fadeUp} className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-600" />
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            {t("landing.hero.animation.ready")}
          </p>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          12 sidor · PDF
        </span>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-3 gap-1.5 mb-2.5">
        {kpis.map((k, i) => {
          const delta = Math.round(((k.value - k.prev) / k.prev) * 100);
          return (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className="rounded-lg border border-border bg-background p-2"
            >
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">
                {k.label}
              </p>
              <p className="text-[12px] font-semibold text-foreground tabular-nums leading-tight mt-0.5">
                {fmt(k.value)}
              </p>
              <p className="text-[9px] font-medium text-emerald-600 tabular-nums mt-0.5">
                +{delta}% vs 2023
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Signature row */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.32 }}
        className="rounded-lg border border-border bg-background p-2.5 mb-2"
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <PenLine className="size-3 text-muted-foreground" />
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Underskrifter
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
          {[
            ["Anna Lind", "Ordförande"],
            ["Erik Sjö", "Ledamot"],
            ["Maria Holm", "Ledamot"],
            ["Johan Berg", "VD"],
          ].map(([name, role]) => (
            <div key={name} className="flex items-center gap-1.5">
              <CheckCircle2 className="size-2.5 text-emerald-600 shrink-0" />
              <span className="text-foreground truncate">{name}</span>
              <span className="text-muted-foreground/80 truncate">· {role}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Export CTA preview */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42, duration: 0.32 }}
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 shadow-sm"
      >
        <Download className="size-3.5" />
        Exportera årsredovisning · PDF
      </motion.div>
    </motion.div>
  );
}
