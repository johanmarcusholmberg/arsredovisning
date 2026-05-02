import { useState } from "react";
import { demoData } from "@/data/demoData";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LinkedNoteIndicator } from "@/components/badges/LinkedNoteIndicator";

const k3WhyRequired: Record<number, { sv: string; en: string }> = {
  1: {
    sv: "Not 1 om redovisningsprinciper är obligatorisk enligt K3 (BFNAR 2012:1) punkt 3.1 och ÅRL 5 kap. 1 §.",
    en: "Note 1 on accounting policies is mandatory under K3 (BFNAR 2012:1) section 3.1 and ÅRL Chapter 5, §1.",
  },
  2: {
    sv: "Övriga rörelseintäkter ska specificeras om de är väsentliga (ÅRL 5 kap. 4 §).",
    en: "Other operating income must be specified if material (ÅRL Chapter 5, §4).",
  },
  3: {
    sv: "Övriga externa kostnader ska specificeras per kostnadspost om beloppet är väsentligt (K3 p. 6.3).",
    en: "Other external costs must be itemized if material (K3 section 6.3).",
  },
  4: {
    sv: "Upplysning om anställda och personalkostnader inklusive könsfördelning är obligatorisk (ÅRL 5 kap. 20 §).",
    en: "Disclosure of employees and personnel costs including gender distribution is mandatory (ÅRL Chapter 5, §20).",
  },
  5: {
    sv: "Av- och nedskrivningar per tillgångsklass ska redovisas (K3 p. 17.28 och 18.20).",
    en: "Depreciation and impairment by asset class must be disclosed (K3 sections 17.28 and 18.20).",
  },
  6: {
    sv: "Långfristiga skulder med förfallodag ska specificeras (ÅRL 5 kap. 14 §).",
    en: "Long-term liabilities with maturity date must be specified (ÅRL Chapter 5, §14).",
  },
  7: {
    sv: "Ställda säkerheter ska alltid upplysas (ÅRL 5 kap. 14 §).",
    en: "Pledged collateral must always be disclosed (ÅRL Chapter 5, §14).",
  },
  8: {
    sv: "Händelser efter balansdagen som är väsentliga ska alltid kommenteras (K3 p. 31.1).",
    en: "Material events after the balance sheet date must always be commented (K3 section 31.1).",
  },
};

const statementRefs: Record<number, number[]> = {
  2: [2], 3: [3], 4: [4], 5: [5], 6: [6],
};

export function NotesSection() {
  const { t, language } = useLanguage();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 1: true });

  const toggle = (n: number) => setExpanded((prev) => ({ ...prev, [n]: !prev[n] }));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("demo.notes.notice")}</p>

      {demoData.notes.map((note) => {
        const isOpen = !!expanded[note.number];
        const referencedInStatements = statementRefs[note.number];
        const whyText = k3WhyRequired[note.number]
          ? (language === "sv" ? k3WhyRequired[note.number].sv : k3WhyRequired[note.number].en)
          : "";
        return (
          <div key={note.number} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/20 transition-colors text-left"
              onClick={() => toggle(note.number)}
            >
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 size-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {note.number}
                </span>
                <span className="text-sm font-semibold text-foreground">{note.title}</span>
              </div>
              {isOpen ? (
                <ChevronDown className="size-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground" />
              )}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/10">
                <p className="text-sm text-foreground leading-relaxed">{note.content}</p>
                {referencedInStatements && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {referencedInStatements.map((r) => (
                      <LinkedNoteIndicator key={r} noteNumber={r} />
                    ))}
                  </div>
                )}
                {whyText && (
                  <details className="mt-3">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                      {t("demo.notes.why.prompt")}
                    </summary>
                    <p className="mt-1 ml-3 text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2 border border-border">
                      {whyText}
                    </p>
                  </details>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
