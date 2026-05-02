import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowRight, Lock, FileDown, Info, Printer, ZoomIn, ZoomOut } from "lucide-react";
import { LockedFeatureTooltip } from "@/components/badges/LockedFeatureTooltip";
import { useState } from "react";

const SAMPLE = {
  companyName: "Exempelbolaget AB",
  orgNr: "559000-0000",
  fiscalYear: "2024-01-01 – 2024-12-31",
  framework: "K3 (BFNAR 2012:1)",
  city: "Stockholm",
  signDate: "2025-04-15",
};

function fmt(n: number): string {
  return n.toLocaleString("sv-SE").replace(/,/g, " ");
}

interface PageProps {
  pageNumber: number;
  totalPages: number;
  children: React.ReactNode;
}

function PdfPage({ pageNumber, totalPages, children }: PageProps) {
  return (
    <div
      className="relative bg-white text-neutral-900 shadow-md mx-auto"
      style={{
        width: "210mm",
        minHeight: "297mm",
        maxWidth: "100%",
        aspectRatio: "210 / 297",
        padding: "20mm 18mm 22mm 18mm",
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "11pt",
        lineHeight: 1.45,
      }}
    >
      {/* Watermark */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
      >
        <span
          style={{
            transform: "rotate(-28deg)",
            fontSize: "120px",
            fontWeight: 900,
            color: "rgba(180, 30, 30, 0.08)",
            letterSpacing: "0.18em",
            whiteSpace: "nowrap",
            fontFamily: "Helvetica, Arial, sans-serif",
          }}
        >
          EXEMPEL
        </span>
      </div>

      {/* Page content */}
      <div className="relative z-10 h-full flex flex-col">{children}</div>

      {/* Footer */}
      <div
        className="absolute left-0 right-0 flex items-center justify-between px-[18mm] text-[9pt] text-neutral-500"
        style={{ bottom: "10mm" }}
      >
        <span>
          {SAMPLE.companyName} · Org.nr {SAMPLE.orgNr}
        </span>
        <span>
          Sida {pageNumber} ({totalPages})
        </span>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-neutral-900 mb-3 mt-2"
      style={{ fontSize: "16pt", fontWeight: 700, letterSpacing: "0.01em" }}
    >
      {children}
    </h2>
  );
}

function StatementRow({
  label,
  current,
  previous,
  noteRef,
  isTotal,
  isHeading,
  indent,
}: {
  label: string;
  current?: number;
  previous?: number;
  noteRef?: number;
  isTotal?: boolean;
  isHeading?: boolean;
  indent?: number;
}) {
  return (
    <tr
      className={
        isTotal
          ? "font-semibold border-t border-neutral-400"
          : isHeading
            ? "font-semibold"
            : ""
      }
    >
      <td
        className="py-1"
        style={{ paddingLeft: indent ? `${indent * 12}px` : 0 }}
      >
        {label}
      </td>
      <td className="py-1 text-center text-neutral-600" style={{ width: "40px" }}>
        {noteRef ?? ""}
      </td>
      <td className="py-1 text-right tabular-nums" style={{ width: "100px" }}>
        {current !== undefined ? fmt(current) : ""}
      </td>
      <td className="py-1 text-right tabular-nums text-neutral-700" style={{ width: "100px" }}>
        {previous !== undefined ? fmt(previous) : ""}
      </td>
    </tr>
  );
}

function StatementHeader() {
  return (
    <thead>
      <tr className="text-[10pt] text-neutral-600 border-b border-neutral-400">
        <th className="text-left pb-1 font-medium">Belopp i kr</th>
        <th className="pb-1 font-medium" style={{ width: "40px" }}>
          Not
        </th>
        <th className="text-right pb-1 font-medium" style={{ width: "100px" }}>
          2024
        </th>
        <th className="text-right pb-1 font-medium" style={{ width: "100px" }}>
          2023
        </th>
      </tr>
    </thead>
  );
}

export function ExamplePdfSection() {
  const { t } = useLanguage();
  const [zoom, setZoom] = useState(0.7);

  const totalPages = 8;

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-2">
          {t("demo.example.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("demo.example.subtitle")}
        </p>
      </div>

      {/* Sample notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
        <Info className="size-4 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-900">{t("demo.example.notice")}</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-red-700 font-medium">
            <span className="size-1.5 rounded-full bg-red-600" />
            {t("demo.example.watermark.label")}
          </span>
          <span className="hidden sm:inline">
            {SAMPLE.companyName} · {SAMPLE.orgNr} · {SAMPLE.fiscalYear}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
            aria-label={t("demo.example.zoom.out")}
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom((z) => Math.min(1.2, z + 0.1))}
            aria-label={t("demo.example.zoom.in")}
          >
            <ZoomIn className="size-4" />
          </Button>
          <LockedFeatureTooltip>
            <Button variant="outline" size="sm" className="gap-2 pointer-events-none ml-2" disabled>
              <Printer className="size-4" />
              {t("demo.example.print")}
            </Button>
          </LockedFeatureTooltip>
          <LockedFeatureTooltip>
            <Button variant="outline" size="sm" className="gap-2 pointer-events-none" disabled>
              <FileDown className="size-4" />
              {t("demo.example.download")}
            </Button>
          </LockedFeatureTooltip>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="rounded-xl border border-border bg-neutral-200 dark:bg-neutral-800 p-4 sm:p-6 overflow-auto">
        <div
          className="space-y-6 mx-auto"
          style={{
            width: `calc(210mm * ${zoom})`,
            maxWidth: "100%",
          }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
              width: "210mm",
            }}
          >
            <div className="space-y-6">
              {/* Page 1 — Cover */}
              <PdfPage pageNumber={1} totalPages={totalPages}>
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <p
                    className="text-neutral-500 mb-3"
                    style={{ fontSize: "11pt", letterSpacing: "0.3em" }}
                  >
                    ÅRSREDOVISNING
                  </p>
                  <h1
                    style={{
                      fontSize: "32pt",
                      fontWeight: 700,
                      letterSpacing: "0.01em",
                    }}
                  >
                    {SAMPLE.companyName}
                  </h1>
                  <p className="mt-2 text-neutral-700" style={{ fontSize: "13pt" }}>
                    Org.nr {SAMPLE.orgNr}
                  </p>
                  <div className="my-10 h-px w-32 bg-neutral-400" />
                  <p className="text-neutral-700" style={{ fontSize: "13pt" }}>
                    Räkenskapsåret
                  </p>
                  <p
                    className="mt-1"
                    style={{ fontSize: "16pt", fontWeight: 600 }}
                  >
                    {SAMPLE.fiscalYear}
                  </p>
                  <p className="mt-10 text-neutral-600" style={{ fontSize: "10pt" }}>
                    Upprättad enligt {SAMPLE.framework}
                  </p>
                </div>
                <div className="text-center text-neutral-500" style={{ fontSize: "9pt" }}>
                  Detta dokument är ett exempel med fiktiva värden.
                </div>
              </PdfPage>

              {/* Page 2 — Innehållsförteckning + start förvaltningsberättelse */}
              <PdfPage pageNumber={2} totalPages={totalPages}>
                <SectionHeading>Innehållsförteckning</SectionHeading>
                <table className="w-full text-[11pt]">
                  <tbody>
                    {[
                      ["Förvaltningsberättelse", "3"],
                      ["Resultaträkning", "4"],
                      ["Balansräkning – Tillgångar", "5"],
                      ["Balansräkning – Eget kapital och skulder", "5"],
                      ["Kassaflödesanalys", "6"],
                      ["Noter", "7"],
                      ["Underskrifter och fastställelseintyg", "8"],
                    ].map(([label, page]) => (
                      <tr key={label} className="border-b border-dotted border-neutral-300">
                        <td className="py-1.5">{label}</td>
                        <td className="py-1.5 text-right tabular-nums w-16">{page}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PdfPage>

              {/* Page 3 — Förvaltningsberättelse */}
              <PdfPage pageNumber={3} totalPages={totalPages}>
                <SectionHeading>Förvaltningsberättelse</SectionHeading>
                <div className="space-y-3 text-justify">
                  <h3 className="font-semibold mt-2">Allmänt om verksamheten</h3>
                  <p>
                    {SAMPLE.companyName} bedriver konsultverksamhet inom design och
                    digital produktutveckling med säte i {SAMPLE.city}. Bolaget grundades
                    2018 och har under räkenskapsåret haft i medeltal 12 anställda.
                    Verksamheten har utvecklats enligt plan med fortsatt tillväxt på den
                    nordiska marknaden.
                  </p>

                  <h3 className="font-semibold mt-3">Väsentliga händelser under året</h3>
                  <p>
                    Under året har bolaget tecknat ramavtal med två nya större kunder och
                    utökat verksamheten med ett kontor i Göteborg. Investeringar har
                    gjorts i internt utvecklade verktyg vilka aktiverats som immateriella
                    anläggningstillgångar.
                  </p>

                  <h3 className="font-semibold mt-3">Flerårsöversikt (kr)</h3>
                  <table className="w-full text-[10pt] mt-1">
                    <thead>
                      <tr className="border-b border-neutral-400">
                        <th className="text-left py-1 font-medium">Nyckeltal</th>
                        <th className="text-right py-1 font-medium">2024</th>
                        <th className="text-right py-1 font-medium">2023</th>
                        <th className="text-right py-1 font-medium">2022</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-neutral-200">
                        <td className="py-1">Nettoomsättning</td>
                        <td className="py-1 text-right tabular-nums">{fmt(4850000)}</td>
                        <td className="py-1 text-right tabular-nums">{fmt(4210000)}</td>
                        <td className="py-1 text-right tabular-nums">{fmt(3680000)}</td>
                      </tr>
                      <tr className="border-b border-neutral-200">
                        <td className="py-1">Resultat efter finansiella poster</td>
                        <td className="py-1 text-right tabular-nums">{fmt(993000)}</td>
                        <td className="py-1 text-right tabular-nums">{fmt(742000)}</td>
                        <td className="py-1 text-right tabular-nums">{fmt(510000)}</td>
                      </tr>
                      <tr className="border-b border-neutral-200">
                        <td className="py-1">Balansomslutning</td>
                        <td className="py-1 text-right tabular-nums">{fmt(5185000)}</td>
                        <td className="py-1 text-right tabular-nums">{fmt(4520000)}</td>
                        <td className="py-1 text-right tabular-nums">{fmt(3950000)}</td>
                      </tr>
                      <tr>
                        <td className="py-1">Soliditet (%)</td>
                        <td className="py-1 text-right tabular-nums">71,1</td>
                        <td className="py-1 text-right tabular-nums">66,4</td>
                        <td className="py-1 text-right tabular-nums">62,8</td>
                      </tr>
                    </tbody>
                  </table>

                  <h3 className="font-semibold mt-3">Förslag till resultatdisposition</h3>
                  <p>
                    Till årsstämmans förfogande står följande vinstmedel:
                    balanserat resultat 2 810 460 kr, årets resultat 774 540 kr,
                    summa 3 585 000 kr. Styrelsen föreslår att vinstmedlen
                    balanseras i ny räkning.
                  </p>
                </div>
              </PdfPage>

              {/* Page 4 — Resultaträkning */}
              <PdfPage pageNumber={4} totalPages={totalPages}>
                <SectionHeading>Resultaträkning</SectionHeading>
                <p className="text-[10pt] text-neutral-600 mb-2">
                  Räkenskapsåret {SAMPLE.fiscalYear}
                </p>
                <table className="w-full text-[10.5pt]">
                  <StatementHeader />
                  <tbody>
                    <StatementRow label="Nettoomsättning" current={4850000} previous={4210000} noteRef={1} />
                    <StatementRow label="Övriga rörelseintäkter" current={125000} previous={98000} noteRef={2} />
                    <StatementRow label="Summa intäkter" current={4975000} previous={4308000} isTotal />
                    <StatementRow label="Råvaror och förnödenheter" current={-620000} previous={-540000} />
                    <StatementRow label="Övriga externa kostnader" current={-1250000} previous={-1080000} noteRef={3} />
                    <StatementRow label="Personalkostnader" current={-1890000} previous={-1660000} noteRef={4} />
                    <StatementRow label="Av- och nedskrivningar" current={-180000} previous={-160000} noteRef={5} />
                    <StatementRow label="Rörelseresultat" current={1035000} previous={868000} isTotal />
                    <StatementRow label="Räntekostnader och liknande" current={-42000} previous={-126000} />
                    <StatementRow label="Resultat efter finansiella poster" current={993000} previous={742000} isTotal />
                    <StatementRow label="Skatt på årets resultat" current={-218460} previous={-163240} />
                    <StatementRow label="Årets resultat" current={774540} previous={578760} isTotal />
                  </tbody>
                </table>
              </PdfPage>

              {/* Page 5 — Balansräkning */}
              <PdfPage pageNumber={5} totalPages={totalPages}>
                <SectionHeading>Balansräkning</SectionHeading>
                <p className="text-[10pt] text-neutral-600 mb-2">Per 2024-12-31</p>
                <h3 className="font-semibold mt-1 mb-1">TILLGÅNGAR</h3>
                <table className="w-full text-[10.5pt]">
                  <StatementHeader />
                  <tbody>
                    <StatementRow label="Anläggningstillgångar" isHeading />
                    <StatementRow label="Immateriella anläggningstillgångar" current={320000} previous={250000} noteRef={5} indent={1} />
                    <StatementRow label="Materiella anläggningstillgångar" current={890000} previous={920000} noteRef={5} indent={1} />
                    <StatementRow label="Summa anläggningstillgångar" current={1210000} previous={1170000} isTotal />
                    <StatementRow label="Omsättningstillgångar" isHeading />
                    <StatementRow label="Kundfordringar" current={1450000} previous={1280000} indent={1} />
                    <StatementRow label="Övriga kortfristiga fordringar" current={185000} previous={142000} indent={1} />
                    <StatementRow label="Kassa och bank" current={2340000} previous={1928000} indent={1} />
                    <StatementRow label="Summa omsättningstillgångar" current={3975000} previous={3350000} isTotal />
                    <StatementRow label="SUMMA TILLGÅNGAR" current={5185000} previous={4520000} isTotal />
                  </tbody>
                </table>

                <h3 className="font-semibold mt-5 mb-1">EGET KAPITAL OCH SKULDER</h3>
                <table className="w-full text-[10.5pt]">
                  <StatementHeader />
                  <tbody>
                    <StatementRow label="Eget kapital" isHeading />
                    <StatementRow label="Aktiekapital" current={100000} previous={100000} indent={1} />
                    <StatementRow label="Balanserat resultat" current={2810460} previous={2231700} indent={1} />
                    <StatementRow label="Årets resultat" current={774540} previous={578760} indent={1} />
                    <StatementRow label="Summa eget kapital" current={3685000} previous={2910460} isTotal />
                    <StatementRow label="Långfristiga skulder" current={500000} previous={750000} noteRef={6} />
                    <StatementRow label="Kortfristiga skulder" isHeading />
                    <StatementRow label="Leverantörsskulder" current={650000} previous={510000} indent={1} />
                    <StatementRow label="Övriga kortfristiga skulder" current={350000} previous={349540} indent={1} />
                    <StatementRow label="Summa skulder" current={1500000} previous={1609540} isTotal />
                    <StatementRow label="SUMMA EGET KAPITAL OCH SKULDER" current={5185000} previous={4520000} isTotal />
                  </tbody>
                </table>
              </PdfPage>

              {/* Page 6 — Kassaflödesanalys */}
              <PdfPage pageNumber={6} totalPages={totalPages}>
                <SectionHeading>Kassaflödesanalys</SectionHeading>
                <p className="text-[10pt] text-neutral-600 mb-2">
                  Räkenskapsåret {SAMPLE.fiscalYear} (indirekt metod)
                </p>
                <table className="w-full text-[10.5pt]">
                  <StatementHeader />
                  <tbody>
                    <StatementRow label="Den löpande verksamheten" isHeading />
                    <StatementRow label="Resultat efter finansiella poster" current={993000} previous={742000} indent={1} />
                    <StatementRow label="Justering för avskrivningar" current={180000} previous={160000} indent={1} />
                    <StatementRow label="Betald inkomstskatt" current={-218460} previous={-163240} indent={1} />
                    <StatementRow label="Kassaflöde före förändring av rörelsekapital" current={954540} previous={738760} isTotal />
                    <StatementRow label="Förändring av kundfordringar" current={-170000} previous={-95000} indent={1} />
                    <StatementRow label="Förändring av leverantörsskulder" current={140000} previous={62000} indent={1} />
                    <StatementRow label="Förändring av övrigt rörelsekapital" current={-43000} previous={-12000} indent={1} />
                    <StatementRow label="Kassaflöde från löpande verksamhet" current={881540} previous={693760} isTotal />
                    <StatementRow label="Investeringsverksamheten" isHeading />
                    <StatementRow label="Förvärv av immateriella anläggningstillgångar" current={-155000} previous={-90000} indent={1} />
                    <StatementRow label="Förvärv av materiella anläggningstillgångar" current={-65000} previous={-180000} indent={1} />
                    <StatementRow label="Kassaflöde från investeringsverksamhet" current={-220000} previous={-270000} isTotal />
                    <StatementRow label="Finansieringsverksamheten" isHeading />
                    <StatementRow label="Amortering av lån" current={-250000} previous={-250000} indent={1} />
                    <StatementRow label="Kassaflöde från finansieringsverksamhet" current={-250000} previous={-250000} isTotal />
                    <StatementRow label="Årets kassaflöde" current={411540} previous={173760} isTotal />
                    <StatementRow label="Likvida medel vid årets början" current={1928460} previous={1754700} />
                    <StatementRow label="Likvida medel vid årets slut" current={2340000} previous={1928460} isTotal />
                  </tbody>
                </table>
              </PdfPage>

              {/* Page 7 — Noter */}
              <PdfPage pageNumber={7} totalPages={totalPages}>
                <SectionHeading>Noter</SectionHeading>
                <div className="space-y-3 text-[10.5pt]">
                  <div>
                    <p className="font-semibold">Not 1 – Redovisningsprinciper</p>
                    <p>
                      Årsredovisningen är upprättad i enlighet med årsredovisningslagen
                      (1995:1554) och Bokföringsnämndens allmänna råd BFNAR 2012:1
                      Årsredovisning och koncernredovisning (K3). Redovisningsprinciperna
                      är oförändrade jämfört med föregående år.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Not 2 – Övriga rörelseintäkter</p>
                    <p>
                      Posten utgörs av erhållna bidrag (75 000 kr) och återbetalning
                      av kostnader (50 000 kr).
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Not 3 – Övriga externa kostnader</p>
                    <table className="w-full mt-1">
                      <tbody>
                        <tr><td className="py-0.5">Lokalhyra</td><td className="py-0.5 text-right tabular-nums">{fmt(480000)}</td></tr>
                        <tr><td className="py-0.5">IT och telekommunikation</td><td className="py-0.5 text-right tabular-nums">{fmt(320000)}</td></tr>
                        <tr><td className="py-0.5">Revision och juridik</td><td className="py-0.5 text-right tabular-nums">{fmt(185000)}</td></tr>
                        <tr><td className="py-0.5">Övrigt</td><td className="py-0.5 text-right tabular-nums">{fmt(265000)}</td></tr>
                        <tr className="border-t border-neutral-400 font-semibold"><td className="py-0.5">Summa</td><td className="py-0.5 text-right tabular-nums">{fmt(1250000)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <p className="font-semibold">Not 4 – Anställda och personalkostnader</p>
                    <p>
                      Medelantal anställda: 12 (varav 9 män och 3 kvinnor). Löner och
                      ersättningar 1 540 000 kr, sociala kostnader 350 000 kr (varav
                      pensionskostnader 142 000 kr).
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Not 5 – Av- och nedskrivningar</p>
                    <p>
                      Avskrivningar enligt plan baseras på nyttjandeperiod: immateriella
                      anläggningstillgångar 5 år, inventarier 5 år. Årets avskrivningar
                      uppgår till 180 000 kr (immateriella 85 000 kr, materiella 95 000 kr).
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Not 6 – Långfristiga skulder</p>
                    <p>
                      Banklån från Nordea Bank, förfall 2027-06-30, räntesats 3,5 %.
                      Utestående belopp 500 000 kr (föregående år 750 000 kr).
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Not 7 – Ställda säkerheter och eventualförpliktelser</p>
                    <p>
                      Företagsinteckning om 1 000 000 kr ställd som säkerhet för
                      banklån. Inga eventualförpliktelser föreligger.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Not 8 – Väsentliga händelser efter balansdagen</p>
                    <p>
                      Inga väsentliga händelser har inträffat efter balansdagen som
                      påverkar bedömningen av årsredovisningen.
                    </p>
                  </div>
                </div>
              </PdfPage>

              {/* Page 8 — Underskrifter + Fastställelseintyg */}
              <PdfPage pageNumber={8} totalPages={totalPages}>
                <SectionHeading>Underskrifter</SectionHeading>
                <p className="text-[10.5pt] mb-6">
                  {SAMPLE.city} {SAMPLE.signDate}
                </p>
                <div className="grid grid-cols-2 gap-x-12 gap-y-10 mt-2">
                  {[
                    { name: "Anna Lindqvist", role: "Styrelseordförande" },
                    { name: "Erik Johansson", role: "Verkställande direktör" },
                    { name: "Maria Persson", role: "Styrelseledamot" },
                    { name: "Karl Andersson", role: "Styrelseledamot" },
                  ].map((p) => (
                    <div key={p.name}>
                      <div className="border-b border-neutral-500 h-10" />
                      <p className="mt-1 text-[10pt] font-semibold">{p.name}</p>
                      <p className="text-[9.5pt] text-neutral-600">{p.role}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-10 border-t border-neutral-400 pt-4">
                  <h3
                    className="font-semibold mb-2"
                    style={{ fontSize: "13pt" }}
                  >
                    Fastställelseintyg
                  </h3>
                  <p className="text-[10.5pt]">
                    Undertecknad styrelseledamot i {SAMPLE.companyName},
                    org.nr {SAMPLE.orgNr}, intygar härmed dels att denna kopia av
                    årsredovisningen överensstämmer med originalet, dels att
                    resultaträkningen och balansräkningen fastställts på årsstämman.
                    Stämman beslutade att godkänna styrelsens förslag till
                    resultatdisposition.
                  </p>
                  <p className="text-[10.5pt] mt-4">
                    {SAMPLE.city} {SAMPLE.signDate}
                  </p>
                  <div className="mt-6 w-1/2">
                    <div className="border-b border-neutral-500 h-10" />
                    <p className="mt-1 text-[10pt] font-semibold">Anna Lindqvist</p>
                    <p className="text-[9.5pt] text-neutral-600">Styrelseordförande</p>
                  </div>
                </div>
              </PdfPage>
            </div>
          </div>
        </div>
      </div>

      {/* Paywall CTA */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 shrink-0">
              <Lock className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {t("demo.example.cta.title")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("demo.example.cta.description")}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Link href="/pricing">
              <Button className="w-full sm:w-auto gap-2">
                {t("demo.example.cta.unlock")}
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" className="w-full sm:w-auto">
                {t("demo.example.cta.pricing")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
