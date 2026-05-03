import {
  FileText, CheckCircle2, ArrowRight, Banknote, ScrollText,
  Link2, ShieldCheck, FileDown, Sparkles,
} from "lucide-react";
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

export function StatementsVisual() {
  const { t } = useLanguage();
  return (
    <div className="relative">
      {/* Balance sheet card (back) */}
      <div className="absolute -top-3 left-3 right-3 rounded-xl border border-border bg-background shadow-sm p-4 opacity-90">
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          {t("publicDemo.statements.br.title")}
        </p>
        <div className="space-y-1.5 text-xs">
          <Row name="Materiella anläggningstillgångar" amount={1850000} note="3" />
          <Row name="Eget kapital" amount={2940000} note="5" />
        </div>
      </div>
      {/* Income statement card (front) */}
      <div className="relative rounded-xl border border-border bg-background shadow-md p-4 mt-12">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            {t("publicDemo.statements.rr.title")}
          </p>
          <p className="text-[10px] text-muted-foreground">{t("publicDemo.statements.unit")}</p>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-xs items-center pb-1.5 border-b border-border">
          <span className="text-muted-foreground">{t("publicDemo.statements.col.post")}</span>
          <span className="text-muted-foreground text-right">{t("publicDemo.statements.col.amount")}</span>
          <span className="text-muted-foreground text-right">{t("publicDemo.statements.col.prev")}</span>
          <span className="text-muted-foreground text-right">{t("publicDemo.statements.col.note")}</span>
        </div>
        <div className="mt-1.5 space-y-1.5">
          <Row name="Nettoomsättning" amount={8420000} prev={7180000} note="1" />
          <Row name="Personalkostnader" amount={-3120000} prev={-2840000} note="2" />
          <Row name="Avskrivningar" amount={-410000} prev={-380000} note="3" />
          <Row name="Rörelseresultat" amount={1240000} prev={1015000} bold />
        </div>
      </div>
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

export function FinishedVisual() {
  const { t } = useLanguage();
  return (
    <div className="relative">
      <div className="absolute -top-3 -right-2 z-10">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wider">
          <Sparkles className="size-3" />
          DEMO
        </span>
      </div>
      <div className="rounded-xl border border-border bg-background shadow-md aspect-[3/4] p-5 flex flex-col">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Årsredovisning
        </p>
        <p className="mt-1 text-base font-semibold text-foreground">Nordic Design AB</p>
        <p className="text-xs text-muted-foreground">556123-4567 · 2024</p>
        <div className="mt-4 space-y-1.5 text-xs text-foreground">
          {[
            "Förvaltningsberättelse",
            "Resultaträkning",
            "Balansräkning",
            "Kassaflödesanalys",
            "Noter",
            "Underskrifter",
          ].map((line, i) => (
            <div key={line} className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground tabular-nums w-4 text-right">
                {i + 1}
              </span>
              <span className="flex-1 truncate">{line}</span>
              <span className="font-mono text-muted-foreground tabular-nums">
                {(i + 1) * 2 + 1}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-3 border-t border-border flex items-center gap-2 text-[10px] text-muted-foreground">
          <FileDown className="size-3" />
          {t("publicDemo.finished.exportHint")}
        </div>
      </div>
    </div>
  );
}
