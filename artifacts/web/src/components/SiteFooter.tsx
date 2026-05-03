import { Link } from "wouter";
import { useLanguage } from "@/hooks/useLanguage";
import type { Language } from "@/contexts/languageContextValue";

const LEGAL_LINKS: ReadonlyArray<{ href: string; key: Parameters<ReturnType<typeof useLanguage>["t"]>[0] }> = [
  { href: "/privacy", key: "footer.link.privacy" },
  { href: "/terms", key: "footer.link.terms" },
  { href: "/support", key: "footer.link.support" },
  { href: "/security", key: "footer.link.security" },
  { href: "/contact", key: "footer.link.contact" },
];

export function SiteFooter() {
  const { t, language, setLanguage } = useLanguage();
  const year = new Date().getFullYear();
  const copyright = t("footer.copyright").replace("{year}", String(year));

  return (
    <footer
      className="border-t border-border bg-muted/30 mt-12"
      role="contentinfo"
      aria-label={language === "sv" ? "Sidfot" : "Footer"}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid gap-10 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Brand + tagline + main disclaimer */}
          <div className="space-y-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="size-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-[11px] font-bold">Å</span>
              </div>
              <span className="font-semibold text-sm tracking-tight text-foreground">
                Årsredovisningar
              </span>
            </Link>
            <p className="text-xs text-muted-foreground italic">
              {t("footer.tagline")}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("footer.disclaimer")}
            </p>
          </div>

          {/* Legal & support links */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
              {t("footer.section.legal")}
            </h3>
            <ul className="space-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                  >
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Language selector + demo note + copyright */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="footer-lang"
                className="text-xs font-semibold uppercase tracking-wider text-foreground/80 block"
              >
                {t("footer.section.lang")} / Language
              </label>
              <select
                id="footer-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                aria-label={t("footer.lang.label")}
                className="w-full sm:w-auto min-w-[10rem] rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="sv">{t("footer.lang.sv")}</option>
                <option value="en">{t("footer.lang.en")}</option>
              </select>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("footer.demo_note")}
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/60">
          <p className="text-xs text-muted-foreground">{copyright}</p>
        </div>
      </div>
    </footer>
  );
}
