import { useState } from "react";
import {
  FileText, CheckCircle2, ArrowRight, Banknote, ScrollText,
  Link2, ShieldCheck, FileDown, Sparkles, ChevronLeft, ChevronRight,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/hooks/useLanguage";

function fmt(n: number) {
  return n.toLocaleString("sv-SE").replace(/,/g, " ");
}

export function ImportVisual() {
  const { t } = useLanguage();
  return (
    <div className="space-y-3">
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
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            <CheckCircle2 className="size-3" />
            {t("publicDemo.import.status.ok")}
          </span>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-full bg-emerald-500" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background p-4 space-y-2 shadow-sm">
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          {t("publicDemo.import.mapping.title")}
        </p>
        {[
          { acc: "3001", name: "Nettoomsättning" },
          { acc: "1930", name: "Bank" },
          { acc: "2440", name: "Leverantörsskulder" },
        ].map((row) => (
          <div key={row.acc} className="flex items-center gap-2 text-sm">
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {row.acc}
            </span>
            <ArrowRight className="size-3 text-muted-foreground shrink-0" />
            <span className="text-foreground truncate">{row.name}</span>
            <CheckCircle2 className="size-3.5 text-emerald-600 ml-auto shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatementCard({
  label,
  unit,
  rows,
  className = "",
  style,
}: {
  label: string;
  unit: string;
  rows: { name: string; amount: number; prev?: number; note?: string; bold?: boolean }[];
  className?: string;
  style?: React.CSSProperties;
}) {
  const { t } = useLanguage();
  return (
    <div
      className={`rounded-xl border border-border bg-background shadow-lg p-4 ${className}`}
      style={style}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-mono uppercase tracking-wider px-2 py-0.5">
          {label}
        </span>
        <p className="text-[10px] text-muted-foreground">{unit}</p>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-[10px] items-center pb-1 border-b border-border">
        <span className="text-muted-foreground">{t("publicDemo.statements.col.post")}</span>
        <span className="text-muted-foreground text-right">{t("publicDemo.statements.col.amount")}</span>
        <span className="text-muted-foreground text-right">{t("publicDemo.statements.col.prev")}</span>
        <span className="text-muted-foreground text-right">{t("publicDemo.statements.col.note")}</span>
      </div>
      <div className="mt-1.5 space-y-1">
        {rows.map((row) => (
          <Row key={row.name} {...row} />
        ))}
      </div>
    </div>
  );
}

export function StatementsVisual() {
  const { t } = useLanguage();
  return (
    <div className="relative h-[400px] w-full">
      {/* Balance sheet — back card, rotated and offset */}
      <StatementCard
        label={t("publicDemo.statements.br.title")}
        unit={t("publicDemo.statements.unit")}
        className="absolute top-0 right-0 w-[88%]"
        style={{ transform: "rotate(3deg)" }}
        rows={[
          { name: "Materiella anläggningstillgångar", amount: 1850000, prev: 1620000, note: "3" },
          { name: "Kundfordringar", amount: 940000, prev: 815000 },
          { name: "Bank", amount: 1320000, prev: 1180000 },
          { name: "Eget kapital", amount: 2940000, prev: 2410000, note: "5" },
          { name: "Långfristiga skulder", amount: 820000, prev: 950000, note: "4" },
          { name: "Summa eget kapital och skulder", amount: 4110000, prev: 3615000, bold: true },
        ]}
      />
      {/* Income statement — front card, rotated the other way */}
      <StatementCard
        label={t("publicDemo.statements.rr.title")}
        unit={t("publicDemo.statements.unit")}
        className="absolute bottom-0 left-0 w-[88%] z-10"
        style={{ transform: "rotate(-2deg)" }}
        rows={[
          { name: "Nettoomsättning", amount: 8420000, prev: 7180000, note: "1" },
          { name: "Personalkostnader", amount: -3120000, prev: -2840000, note: "2" },
          { name: "Avskrivningar", amount: -410000, prev: -380000, note: "3" },
          { name: "Rörelseresultat", amount: 1240000, prev: 1015000, bold: true },
        ]}
      />

    </div>
  );
}

function Row({
  name,
  amount,
  prev,
  note,
  bold,
}: {
  name: string;
  amount: number;
  prev?: number;
  note?: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center ${
        bold ? "font-semibold text-foreground border-t border-border pt-1.5" : "text-foreground"
      }`}
    >
      <span className="truncate">{name}</span>
      <span className="text-right tabular-nums">{fmt(amount)}</span>
      <span className="text-right tabular-nums text-muted-foreground">
        {prev !== undefined ? fmt(prev) : ""}
      </span>
      <span className="text-right">
        {note ? (
          <span className="inline-flex items-center justify-center min-w-[1.5rem] rounded bg-primary/10 text-primary text-[10px] font-mono px-1.5 py-0.5">
            {note}
          </span>
        ) : (
          ""
        )}
      </span>
    </div>
  );
}

export function CashFlowVisual() {
  const { t } = useLanguage();
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2">
          <Banknote className="size-4 text-amber-700" />
          <p className="text-xs font-semibold text-amber-900">
            {t("publicDemo.cashflow.assess.title")}
          </p>
        </div>
        <p className="mt-1.5 text-sm text-amber-900">
          {t("publicDemo.cashflow.assess.value")}
        </p>
        <p className="mt-1 text-[11px] text-amber-700">
          {t("publicDemo.cashflow.assess.hint")}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-background p-4 space-y-2 shadow-sm">
        {[
          { label: "Löpande verksamhet", value: 1620000 },
          { label: "Investeringsverksamhet", value: -420000 },
          { label: "Finansieringsverksamhet", value: -180000 },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="text-foreground">{row.label}</span>
            <span className="font-mono tabular-nums text-foreground">
              {fmt(row.value)}
            </span>
          </div>
        ))}
        <div className="pt-2 mt-2 border-t border-border flex items-center justify-between text-sm font-semibold">
          <span>Periodens kassaflöde</span>
          <span className="font-mono tabular-nums">{fmt(1020000)}</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        {t("publicDemo.cashflow.adjust")}
      </p>
    </div>
  );
}

export function NotesVisual() {
  const { t } = useLanguage();
  const notes = [
    { n: "1", title: "Nettoomsättning" },
    { n: "2", title: "Anställda och personalkostnader" },
    { n: "3", title: "Materiella anläggningstillgångar" },
    { n: "4", title: "Långfristiga skulder" },
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-background p-4 shadow-sm space-y-1.5">
        {notes.map((note) => (
          <div key={note.n} className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center justify-center size-6 rounded bg-primary/10 text-primary font-mono text-xs font-semibold">
              {note.n}
            </span>
            <span className="text-foreground">Not {note.n} {note.title}</span>
            <CheckCircle2 className="size-3.5 text-emerald-600 ml-auto" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs">
          <ScrollText className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Materiella anläggningstillgångar</span>
          <Link2 className="size-3 text-muted-foreground" />
          <span className="inline-flex items-center justify-center min-w-[1.5rem] rounded bg-primary/10 text-primary text-[10px] font-mono px-1.5 py-0.5">
            3
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2 text-xs text-emerald-800">
        <ShieldCheck className="size-4 text-emerald-700" />
        <div className="flex flex-col">
          <span className="font-semibold">{t("publicDemo.notes.validation.ok")}</span>
          <span className="text-emerald-700/90">{t("publicDemo.notes.validation.detail")}</span>
        </div>
      </div>
    </div>
  );
}

interface MiniPage {
  label: string;
  render: () => React.ReactNode;
}

function MiniRow({
  name,
  amount,
  note,
  bold,
}: {
  name: string;
  amount?: string;
  note?: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto] gap-x-2 items-center text-[9px] ${
        bold ? "font-semibold border-t border-neutral-300 pt-1 mt-1" : ""
      }`}
    >
      <span className="truncate text-neutral-800">{name}</span>
      <span className="text-right tabular-nums text-neutral-800">{amount ?? ""}</span>
      <span className="text-right">
        {note ? (
          <span className="inline-flex items-center justify-center min-w-[1rem] rounded bg-amber-100 text-amber-800 text-[8px] font-mono px-1">
            {note}
          </span>
        ) : (
          ""
        )}
      </span>
    </div>
  );
}

const miniPages: MiniPage[] = [
  {
    label: "Omslag",
    render: () => (
      <div className="h-full flex flex-col">
        <p className="text-[9px] font-mono uppercase tracking-wider text-neutral-500">
          Årsredovisning
        </p>
        <p className="mt-1 text-base font-semibold text-neutral-900 font-serif">
          Nordic Design AB
        </p>
        <p className="text-[10px] text-neutral-600">556123-4567</p>
        <div className="mt-auto pt-4 border-t border-neutral-300 text-[9px] text-neutral-600 space-y-0.5">
          <p>Räkenskapsår 2024-01-01 – 2024-12-31</p>
          <p>Säte: Stockholm</p>
          <p>K3 (BFNAR 2012:1)</p>
        </div>
      </div>
    ),
  },
  {
    label: "Innehåll",
    render: () => (
      <div className="h-full flex flex-col">
        <p className="text-[10px] font-semibold text-neutral-900 font-serif border-b border-neutral-300 pb-1">
          Innehållsförteckning
        </p>
        <div className="mt-2 space-y-1 text-[10px] text-neutral-800">
          {[
            ["Förvaltningsberättelse", 2],
            ["Resultaträkning", 4],
            ["Balansräkning", 5],
            ["Kassaflödesanalys", 7],
            ["Noter", 8],
            ["Underskrifter", 12],
          ].map(([title, page]) => (
            <div key={title} className="flex items-baseline gap-1">
              <span>{title}</span>
              <span className="flex-1 border-b border-dotted border-neutral-400 mx-1 translate-y-[-2px]" />
              <span className="font-mono tabular-nums text-neutral-600">{page}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: "Resultaträkning",
    render: () => (
      <div className="h-full flex flex-col">
        <p className="text-[10px] font-semibold text-neutral-900 font-serif border-b border-neutral-300 pb-1">
          Resultaträkning
        </p>
        <p className="text-[8px] text-neutral-500 mt-0.5">2024-01-01 – 2024-12-31 (kr)</p>
        <div className="mt-2 space-y-1">
          <MiniRow name="Nettoomsättning" amount="8 420 000" note="1" />
          <MiniRow name="Övriga rörelseintäkter" amount="120 000" />
          <MiniRow name="Personalkostnader" amount="-3 120 000" note="2" />
          <MiniRow name="Avskrivningar" amount="-410 000" note="3" />
          <MiniRow name="Övriga kostnader" amount="-3 770 000" />
          <MiniRow name="Rörelseresultat" amount="1 240 000" bold />
          <MiniRow name="Finansiella poster" amount="-95 000" />
          <MiniRow name="Skatt" amount="-258 000" />
          <MiniRow name="Årets resultat" amount="887 000" bold />
        </div>
      </div>
    ),
  },
  {
    label: "Balansräkning",
    render: () => (
      <div className="h-full flex flex-col">
        <p className="text-[10px] font-semibold text-neutral-900 font-serif border-b border-neutral-300 pb-1">
          Balansräkning
        </p>
        <p className="text-[8px] text-neutral-500 mt-0.5">Per 2024-12-31 (kr)</p>
        <div className="mt-2 space-y-1">
          <MiniRow name="Materiella anl.tillg." amount="1 850 000" note="3" />
          <MiniRow name="Kundfordringar" amount="940 000" />
          <MiniRow name="Bank" amount="1 320 000" />
          <MiniRow name="Summa tillgångar" amount="4 110 000" bold />
          <MiniRow name="Eget kapital" amount="2 940 000" note="5" />
          <MiniRow name="Långfristiga skulder" amount="820 000" note="4" />
          <MiniRow name="Kortfristiga skulder" amount="350 000" />
          <MiniRow name="Summa EK och skulder" amount="4 110 000" bold />
        </div>
      </div>
    ),
  },
  {
    label: "Noter",
    render: () => (
      <div className="h-full flex flex-col">
        <p className="text-[10px] font-semibold text-neutral-900 font-serif border-b border-neutral-300 pb-1">
          Noter
        </p>
        <div className="mt-2 space-y-1.5 text-[9px] text-neutral-800">
          <div>
            <p className="font-semibold">Not 1 — Nettoomsättning</p>
            <p className="text-neutral-600">
              Försäljning av designtjänster i Sverige.
            </p>
          </div>
          <div>
            <p className="font-semibold">Not 2 — Anställda</p>
            <p className="text-neutral-600">
              Medelantal anställda: 6 (5).
            </p>
          </div>
          <div>
            <p className="font-semibold">Not 3 — Materiella anl.tillg.</p>
            <p className="text-neutral-600">
              Inventarier, avskrivningstid 5 år.
            </p>
          </div>
          <div>
            <p className="font-semibold">Not 4 — Långfristiga skulder</p>
            <p className="text-neutral-600">
              Banklån, förfaller efter mer än 1 år.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: "Underskrifter",
    render: () => (
      <div className="h-full flex flex-col">
        <p className="text-[10px] font-semibold text-neutral-900 font-serif border-b border-neutral-300 pb-1">
          Underskrifter
        </p>
        <p className="mt-2 text-[9px] text-neutral-700 leading-relaxed">
          Resultat- och balansräkningen kommer att framläggas på årsstämman
          för fastställelse.
        </p>
        <p className="mt-3 text-[9px] text-neutral-700">Stockholm, 2025-04-15</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-[9px] text-neutral-700">
          {["Anna Lind", "Erik Sjö", "Maria Holm", "Johan Berg"].map((name) => (
            <div key={name}>
              <div className="border-b border-neutral-400 h-5" />
              <p className="mt-0.5">{name}</p>
              <p className="text-neutral-500 text-[8px]">Styrelseledamot</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

export function FinishedVisual() {
  const { t } = useLanguage();
  const [pageIndex, setPageIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const total = miniPages.length;
  const goPrev = () => {
    if (pageIndex === 0) return;
    setDirection(-1);
    setPageIndex(pageIndex - 1);
  };
  const goNext = () => {
    if (pageIndex === total - 1) return;
    setDirection(1);
    setPageIndex(pageIndex + 1);
  };

  const current = miniPages[pageIndex];

  return (
    <div className="w-full">
      <div
        className="relative mx-auto"
        style={{ perspective: "1400px", width: "100%", maxWidth: "260px" }}
      >
        {/* Page stack shadow under the active page */}
        <div
          aria-hidden
          className="absolute inset-x-2 top-2 bottom-0 rounded-xl bg-neutral-300/60"
          style={{ transform: "translateY(6px) translateX(4px)" }}
        />
        <div
          aria-hidden
          className="absolute inset-x-3 top-1 bottom-0 rounded-xl bg-neutral-200"
          style={{ transform: "translateY(3px) translateX(2px)" }}
        />

        <div
          className="relative aspect-[3/4] rounded-xl border border-neutral-300 bg-white shadow-xl overflow-hidden"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* DEMO badge */}
          <div className="absolute top-2 right-2 z-20">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 uppercase tracking-wider">
              <Sparkles className="size-2.5" />
              DEMO
            </span>
          </div>

          {/* Watermark */}
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          >
            <span
              style={{
                transform: "rotate(-26deg)",
                fontSize: "60px",
                fontWeight: 900,
                color: "rgba(180, 30, 30, 0.07)",
                letterSpacing: "0.18em",
                whiteSpace: "nowrap",
              }}
            >
              EXEMPEL
            </span>
          </div>

          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={pageIndex}
              custom={direction}
              initial={{ rotateY: direction > 0 ? -85 : 85, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: direction > 0 ? 85 : -85, opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
              className="relative h-full w-full p-3.5 z-10"
              style={{
                transformOrigin: direction > 0 ? "left center" : "right center",
                backfaceVisibility: "hidden",
              }}
            >
              {current.render()}
            </motion.div>
          </AnimatePresence>

          {/* Page footer */}
          <div className="absolute bottom-1.5 left-3 right-3 z-10 flex items-center justify-between text-[8px] text-neutral-500">
            <span>Nordic Design AB</span>
            <span className="font-mono tabular-nums">
              {pageIndex + 1} / {total}
            </span>
          </div>
        </div>
      </div>

      {/* Flip controls */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={pageIndex === 0}
          aria-label={t("publicDemo.finished.prev")}
          className="inline-flex items-center justify-center size-8 rounded-full border border-border bg-background text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-[11px] font-medium text-foreground">{current.label}</p>
          <div className="mt-1 flex items-center justify-center gap-1">
            {miniPages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setDirection(i > pageIndex ? 1 : -1);
                  setPageIndex(i);
                }}
                aria-label={`${t("publicDemo.finished.goto")} ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === pageIndex ? "w-5 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={pageIndex === total - 1}
          aria-label={t("publicDemo.finished.next")}
          className="inline-flex items-center justify-center size-8 rounded-full border border-border bg-background text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <p className="mt-2 text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1">
        <FileDown className="size-3" />
        {t("publicDemo.finished.exportHint")}
      </p>
    </div>
  );
}
