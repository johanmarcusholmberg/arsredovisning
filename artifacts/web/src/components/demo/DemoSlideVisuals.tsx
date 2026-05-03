import { useState } from "react";
import {
  FileText, CheckCircle2, ArrowRight, Banknote, ScrollText,
  Link2, ShieldCheck, Sparkles, ChevronLeft, ChevronRight,
  Maximize2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/hooks/useLanguage";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
      className={`grid grid-cols-[1fr_auto_1.6em] gap-x-[0.5em] items-baseline text-[0.85em] leading-tight ${
        bold ? "font-semibold border-t border-neutral-300 pt-[0.25em] mt-[0.25em]" : ""
      }`}
    >
      <span className="text-neutral-800 break-words min-w-0">{name}</span>
      <span className="text-right tabular-nums text-neutral-800 whitespace-nowrap">
        {amount ?? ""}
      </span>
      <span className="text-right">
        {note ? (
          <span className="inline-flex items-center justify-center min-w-[1.4em] rounded bg-amber-100 text-amber-800 text-[0.8em] font-mono px-[0.3em]">
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
        <p className="text-[0.85em] font-mono uppercase tracking-wider text-neutral-500">
          Årsredovisning
        </p>
        <p className="mt-[0.4em] text-[1.7em] leading-tight font-semibold text-neutral-900 font-serif">
          Nordic Design AB
        </p>
        <p className="text-[0.95em] text-neutral-600">556123-4567</p>
        <p className="mt-[0.3em] text-[0.85em] text-neutral-500">
          för räkenskapsåret 2024
        </p>

        {/* Centered decorative block fills the middle of the cover so it
            doesn't look empty. Year + a thin divider + tagline. */}
        <div className="flex-1 flex flex-col items-center justify-center text-center my-[1em]">
          <p className="font-serif font-semibold text-neutral-900 text-[3.2em] leading-none tabular-nums">
            2024
          </p>
          <div className="mt-[0.6em] h-px w-[40%] bg-neutral-300" />
          <p className="mt-[0.6em] text-[0.8em] uppercase tracking-[0.25em] text-neutral-500">
            Verksamhetsåret
          </p>
        </div>

        <div className="pt-[0.6em] border-t border-neutral-300 text-[0.85em] text-neutral-600 space-y-[0.15em]">
          <p>Räkenskapsår 2024-01-01 – 2024-12-31</p>
          <p>Säte: Stockholm</p>
          <p>Tillämpat regelverk: K3 (BFNAR 2012:1)</p>
          <p>Upprättad: 2025-04-15</p>
        </div>
      </div>
    ),
  },
  {
    label: "Innehåll",
    render: () => (
      <div className="h-full flex flex-col">
        <p className="text-[1.1em] font-semibold text-neutral-900 font-serif border-b border-neutral-300 pb-[0.3em]">
          Innehållsförteckning
        </p>
        <div className="mt-[0.6em] space-y-[0.3em] text-[1em] text-neutral-800">
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
    label: "Förvaltningsberättelse",
    render: () => (
      <div className="h-full flex flex-col">
        <p className="text-[1.1em] font-semibold text-neutral-900 font-serif border-b border-neutral-300 pb-[0.3em]">
          Förvaltningsberättelse
        </p>
        <div className="mt-[0.5em] space-y-[0.5em] text-[0.9em] text-neutral-800 leading-relaxed">
          <div>
            <p className="font-semibold">Verksamheten</p>
            <p className="text-neutral-700">
              Nordic Design AB bedriver konsultverksamhet inom grafisk
              formgivning och varumärkesutveckling med kunder främst i Sverige
              och Norden.
            </p>
          </div>
          <div>
            <p className="font-semibold">Väsentliga händelser under året</p>
            <p className="text-neutral-700">
              Bolaget har under året utökat personalstyrkan med en seniordesigner
              och tecknat två nya ramavtal.
            </p>
          </div>
          <div>
            <p className="font-semibold">Flerårsöversikt (tkr)</p>
            <div className="mt-[0.3em] grid grid-cols-[1fr_auto_auto_auto] gap-x-[0.5em] text-[0.8em] tabular-nums whitespace-nowrap leading-tight">
              <span className="text-neutral-500"></span>
              <span className="text-right text-neutral-500">2024</span>
              <span className="text-right text-neutral-500">2023</span>
              <span className="text-right text-neutral-500">2022</span>
              <span>Nettoomsättning</span>
              <span className="text-right">8 420</span>
              <span className="text-right">7 180</span>
              <span className="text-right">6 540</span>
              <span>Rörelseresultat</span>
              <span className="text-right">1 240</span>
              <span className="text-right">1 015</span>
              <span className="text-right">820</span>
              <span>Soliditet (%)</span>
              <span className="text-right">71,5</span>
              <span className="text-right">66,7</span>
              <span className="text-right">62,1</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: "Resultaträkning",
    render: () => (
      <div className="h-full flex flex-col">
        <p className="text-[1.1em] font-semibold text-neutral-900 font-serif border-b border-neutral-300 pb-[0.3em]">
          Resultaträkning
        </p>
        <p className="text-[0.8em] text-neutral-500 mt-[0.15em]">
          2024-01-01 – 2024-12-31 (kr)
        </p>
        <div className="mt-[0.5em] space-y-[0.3em]">
          <MiniRow name="Nettoomsättning" amount="8 420 000" note="1" />
          <MiniRow name="Övriga rörelseintäkter" amount="120 000" />
          <MiniRow name="Personalkostnader" amount="-3 120 000" note="2" />
          <MiniRow name="Avskrivningar" amount="-410 000" note="3" />
          <MiniRow name="Övriga kostnader" amount="-3 770 000" />
          <MiniRow name="Rörelseresultat" amount="1 240 000" bold />
          <MiniRow name="Finansiella intäkter" amount="12 000" />
          <MiniRow name="Finansiella kostnader" amount="-107 000" />
          <MiniRow name="Resultat före skatt" amount="1 145 000" bold />
          <MiniRow name="Skatt på årets resultat" amount="-258 000" />
          <MiniRow name="Årets resultat" amount="887 000" bold />
        </div>
      </div>
    ),
  },
  {
    label: "Balansräkning",
    render: () => (
      <div className="h-full flex flex-col">
        <p className="text-[1.1em] font-semibold text-neutral-900 font-serif border-b border-neutral-300 pb-[0.3em]">
          Balansräkning
        </p>
        <p className="text-[0.8em] text-neutral-500 mt-[0.15em]">Per 2024-12-31 (kr)</p>
        <div className="mt-[0.5em] space-y-[0.3em]">
          <p className="text-[0.85em] uppercase tracking-wider text-neutral-500 mt-[0.2em]">Tillgångar</p>
          <MiniRow name="Materiella anläggningstillgångar" amount="1 850 000" note="3" />
          <MiniRow name="Kundfordringar" amount="940 000" />
          <MiniRow name="Övriga fordringar" amount="0" />
          <MiniRow name="Bank" amount="1 320 000" />
          <MiniRow name="Summa tillgångar" amount="4 110 000" bold />
          <p className="text-[0.85em] uppercase tracking-wider text-neutral-500 mt-[0.4em]">
            Eget kapital och skulder
          </p>
          <MiniRow name="Eget kapital" amount="2 940 000" note="5" />
          <MiniRow name="Långfristiga skulder" amount="820 000" note="4" />
          <MiniRow name="Kortfristiga skulder" amount="350 000" />
          <MiniRow name="Summa EK och skulder" amount="4 110 000" bold />
        </div>
      </div>
    ),
  },
  {
    label: "Kassaflödesanalys",
    render: () => (
      <div className="h-full flex flex-col">
        <p className="text-[1.1em] font-semibold text-neutral-900 font-serif border-b border-neutral-300 pb-[0.3em]">
          Kassaflödesanalys
        </p>
        <p className="text-[0.8em] text-neutral-500 mt-[0.15em]">
          2024-01-01 – 2024-12-31 (kr)
        </p>
        <div className="mt-[0.5em] space-y-[0.3em]">
          <p className="text-[0.85em] uppercase tracking-wider text-neutral-500 mt-[0.2em]">
            Den löpande verksamheten
          </p>
          <MiniRow name="Resultat före skatt" amount="1 145 000" />
          <MiniRow name="Justering för avskrivningar" amount="410 000" note="3" />
          <MiniRow name="Betald inkomstskatt" amount="-220 000" />
          <MiniRow name="Förändring av kundfordringar" amount="-180 000" />
          <MiniRow name="Förändring av kortfristiga skulder" amount="95 000" />
          <MiniRow name="Kassaflöde löpande verksamhet" amount="1 250 000" bold />

          <p className="text-[0.85em] uppercase tracking-wider text-neutral-500 mt-[0.4em]">
            Investeringsverksamheten
          </p>
          <MiniRow name="Investeringar i inventarier" amount="-410 000" note="3" />

          <p className="text-[0.85em] uppercase tracking-wider text-neutral-500 mt-[0.4em]">
            Finansieringsverksamheten
          </p>
          <MiniRow name="Amortering av banklån" amount="-180 000" note="4" />
          <MiniRow name="Utbetald utdelning" amount="-200 000" />

          <MiniRow name="Årets kassaflöde" amount="460 000" bold />
          <MiniRow name="Likvida medel vid årets början" amount="860 000" />
          <MiniRow name="Likvida medel vid årets slut" amount="1 320 000" bold />
        </div>
      </div>
    ),
  },
  {
    label: "Noter",
    render: () => (
      <div className="h-full flex flex-col">
        <p className="text-[1.1em] font-semibold text-neutral-900 font-serif border-b border-neutral-300 pb-[0.3em]">
          Noter
        </p>
        <div className="mt-[0.5em] space-y-[0.6em] text-[0.9em] text-neutral-800 leading-relaxed">
          <div>
            <p className="font-semibold">Not 1 — Nettoomsättning</p>
            <p className="text-neutral-700">
              Försäljning av designtjänster, samtliga inom Sverige.
            </p>
          </div>
          <div>
            <p className="font-semibold">Not 2 — Anställda och personalkostnader</p>
            <p className="text-neutral-700">
              Medelantal anställda under året: 6 (föregående år 5). Löner och
              ersättningar uppgick till 2 580 tkr (2 320).
            </p>
          </div>
          <div>
            <p className="font-semibold">Not 3 — Materiella anläggningstillgångar</p>
            <p className="text-neutral-700">
              Inventarier skrivs av linjärt över 5 år. Ingående anskaffnings­värde
              2 280 tkr, årets investeringar 410 tkr.
            </p>
          </div>
          <div>
            <p className="font-semibold">Not 4 — Långfristiga skulder</p>
            <p className="text-neutral-700">
              Banklån som förfaller till betalning senare än ett år efter
              balansdagen.
            </p>
          </div>
          <div>
            <p className="font-semibold">Not 5 — Eget kapital</p>
            <p className="text-neutral-700">
              Aktiekapital 100 tkr, balanserat resultat 1 953 tkr, årets
              resultat 887 tkr.
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
        <p className="text-[1.1em] font-semibold text-neutral-900 font-serif border-b border-neutral-300 pb-[0.3em]">
          Underskrifter
        </p>
        <p className="mt-[0.6em] text-[0.9em] text-neutral-700 leading-relaxed">
          Resultat- och balansräkningen kommer att framläggas på årsstämman
          för fastställelse.
        </p>
        <p className="mt-[0.6em] text-[0.9em] text-neutral-700">Stockholm, 2025-04-15</p>
        <div className="mt-[1em] grid grid-cols-2 gap-[0.8em] text-[0.9em] text-neutral-700">
          {[
            ["Anna Lind", "Styrelseordförande"],
            ["Erik Sjö", "Styrelseledamot"],
            ["Maria Holm", "Styrelseledamot"],
            ["Johan Berg", "Verkställande direktör"],
          ].map(([name, role]) => (
            <div key={name}>
              <div className="border-b border-neutral-400 h-[1.6em]" />
              <p className="mt-[0.2em]">{name}</p>
              <p className="text-neutral-500 text-[0.8em]">{role}</p>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-[0.8em] text-[0.8em] text-neutral-500 border-t border-neutral-200">
          Min revisionsberättelse har lämnats 2025-04-15. — Auktoriserad revisor
        </div>
      </div>
    ),
  },
];

function FlipReport({
  variant,
  pageIndex,
  setPageIndex,
}: {
  variant: "sm" | "lg";
  pageIndex: number;
  setPageIndex: (next: number, direction: 1 | -1) => void;
}) {
  const { t } = useLanguage();
  const [direction, setDirection] = useState<1 | -1>(1);
  const total = miniPages.length;
  const current = miniPages[pageIndex];

  const isLg = variant === "lg";

  const goPrev = () => {
    if (pageIndex === 0) return;
    setDirection(-1);
    setPageIndex(pageIndex - 1, -1);
  };
  const goNext = () => {
    if (pageIndex === total - 1) return;
    setDirection(1);
    setPageIndex(pageIndex + 1, 1);
  };

  // Base font size drives all em-relative sizes inside pages.
  // For lg, both font size and width are derived from viewport so the
  // popup scales gracefully on phones, tablets, and large monitors.
  // Page aspect is 3:4 (width:height); constrain by both viewport width
  // and viewport height (leaving headroom for the controls row).
  const lgWidthCss = "min(92vw, calc(72vh * 0.75))";
  const lgFontCss = `calc(${lgWidthCss} / 26)`;
  const lgWatermarkCss = `calc(${lgWidthCss} / 4)`;

  const pageWrapperStyle: React.CSSProperties = isLg
    ? { perspective: "1600px", width: lgWidthCss, maxWidth: "92vw" }
    : { perspective: "1600px", width: "100%", maxWidth: 260 };

  // Slightly more bottom padding so the absolutely-positioned page footer
  // (Nordic Design AB · n/n) doesn't visually crowd the page content.
  const padding = isLg ? "px-[6%] pt-[6%] pb-[9%]" : "px-3 pt-3 pb-5";

  const demoBadge = (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 font-bold text-amber-800 uppercase tracking-wider shadow-sm"
      style={
        isLg
          ? { fontSize: "12px", padding: "4px 10px" }
          : { fontSize: "9px", padding: "2px 6px" }
      }
    >
      <Sparkles style={isLg ? { width: 14, height: 14 } : { width: 10, height: 10 }} />
      DEMO
    </span>
  );

  const sideArrowBtn = (dir: "prev" | "next") => {
    const isPrev = dir === "prev";
    return (
      <button
        type="button"
        onClick={isPrev ? goPrev : goNext}
        disabled={isPrev ? pageIndex === 0 : pageIndex === total - 1}
        aria-label={t(
          isPrev ? "publicDemo.finished.prev" : "publicDemo.finished.next",
        )}
        className="inline-flex items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-md hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed size-11 shrink-0 backdrop-blur-sm"
      >
        {isPrev ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
      </button>
    );
  };

  return (
    <div className={isLg ? "w-full flex flex-col items-center" : "w-full"}>
      {/* DEMO badge above the page (both variants, like the popup) */}
      <div className={isLg ? "mb-2 flex justify-center" : "mb-1.5 flex justify-center"}>
        {demoBadge}
      </div>

      {/* Page + side arrows row (arrows only for lg) */}
      <div
        className={
          isLg
            ? "flex items-center justify-center gap-2 sm:gap-4 w-full"
            : "w-full flex justify-center"
        }
      >
        {isLg && sideArrowBtn("prev")}

        <div className="relative" style={pageWrapperStyle}>
        {/* Stacked-page shadows */}
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
          {/* Watermark */}
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          >
            <span
              style={{
                transform: "rotate(-26deg)",
                fontSize: isLg ? lgWatermarkCss : "56px",
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
              className={`relative h-full w-full ${padding} z-10`}
              style={{
                transformOrigin: direction > 0 ? "left center" : "right center",
                backfaceVisibility: "hidden",
                fontSize: isLg ? lgFontCss : "10px",
              }}
            >
              {current.render()}
            </motion.div>
          </AnimatePresence>

          {/* Page footer */}
          <div
            className={`absolute z-10 flex items-center justify-between text-neutral-500 ${
              isLg ? "bottom-[2%] left-[5%] right-[5%]" : "bottom-1.5 left-3 right-3 text-[8px]"
            }`}
            style={isLg ? { fontSize: `calc(${lgFontCss} * 0.75)` } : undefined}
          >
            <span>Nordic Design AB</span>
            <span className="font-mono tabular-nums">
              {pageIndex + 1} / {total}
            </span>
          </div>
        </div>
        </div>

        {isLg && sideArrowBtn("next")}
      </div>

      {/* Bottom area: label + dots (and prev/next arrows for sm only) */}
      {isLg ? (
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <p className="text-sm font-medium text-foreground">{current.label}</p>
          <div className="flex items-center justify-center gap-1">
            {miniPages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const dir: 1 | -1 = i > pageIndex ? 1 : -1;
                  setDirection(dir);
                  setPageIndex(i, dir);
                }}
                aria-label={`${t("publicDemo.finished.goto")} ${i + 1}`}
                className={`rounded-full transition-all h-2 ${
                  i === pageIndex
                    ? "bg-primary w-7"
                    : "bg-white/70 hover:bg-white w-2"
                }`}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={pageIndex === 0}
            aria-label={t("publicDemo.finished.prev")}
            className="inline-flex items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed size-8"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex-1 text-center">
            <p className="font-medium text-foreground text-[11px]">
              {current.label}
            </p>
            <div className="mt-1.5 flex items-center justify-center gap-1">
              {miniPages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const dir: 1 | -1 = i > pageIndex ? 1 : -1;
                    setDirection(dir);
                    setPageIndex(i, dir);
                  }}
                  aria-label={`${t("publicDemo.finished.goto")} ${i + 1}`}
                  className={`rounded-full transition-all h-1.5 ${
                    i === pageIndex
                      ? "bg-primary w-5"
                      : "bg-border hover:bg-muted-foreground/40 w-1.5"
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
            className="inline-flex items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed size-8"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function FinishedVisual() {
  const { t } = useLanguage();
  const [pageIndex, setPageIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [largePageIndex, setLargePageIndex] = useState(0);

  return (
    <div className="w-full flex flex-col items-center">
      <FlipReport
        variant="sm"
        pageIndex={pageIndex}
        setPageIndex={(next) => setPageIndex(next)}
      />

      <div className="mt-2 flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setLargePageIndex(pageIndex);
            setOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-accent transition-colors"
        >
          <Maximize2 className="size-3" />
          {t("publicDemo.finished.viewLarger")}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-transparent border-0 shadow-none p-0 max-w-none w-auto sm:max-w-none sm:rounded-none gap-0 grid-cols-1 [&>button]:bg-white/90 [&>button]:rounded-full [&>button]:p-1.5 [&>button]:top-2 [&>button]:right-2 [&>button]:shadow">
          <DialogTitle className="sr-only">
            {t("publicDemo.finished.dialog.title")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("publicDemo.finished.dialog.subtitle")}
          </DialogDescription>
          <div className="flex justify-center">
            <FlipReport
              variant="lg"
              pageIndex={largePageIndex}
              setPageIndex={(next) => setLargePageIndex(next)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
