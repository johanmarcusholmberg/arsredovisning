/**
 * Compact in-app footer rendered at the bottom of the workspace shell.
 *
 * Notes:
 * - The legal pages live in the *marketing* artifact (mounted at "/"), so the
 *   links use plain anchors with absolute hrefs (e.g. "/privacy") to perform
 *   real cross-artifact navigation rather than wouter SPA routing inside
 *   `arsredovisningar` (which is mounted under "/arsredovisningar/").
 * - Copy is pulled from the shared i18n strings so the footer respects the
 *   user's chosen language (sv/en).
 * - Designed to stay visually quiet so it never competes with the active
 *   workflow (validation panels, export preview, etc.).
 */

import { useLanguage } from "@/hooks/useLanguage";
import type { StringKey } from "@/i18n/strings";

const LINKS: ReadonlyArray<{ href: string; key: StringKey }> = [
  { href: "/privacy", key: "footer.legal.privacy" },
  { href: "/terms", key: "footer.legal.terms" },
  { href: "/support", key: "footer.legal.support" },
  { href: "/security", key: "footer.legal.security" },
  { href: "/contact", key: "footer.legal.contact" },
];

export function AppFooter() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className="mt-10 border-t border-border/60 pt-4 pb-2 text-xs text-muted-foreground"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-relaxed max-w-3xl">{t("footer.disclaimer")}</p>
        <nav
          aria-label="Legal"
          className="flex flex-wrap gap-x-4 gap-y-1 shrink-0"
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_top"
              rel="noopener"
              className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            >
              {t(link.key)}
            </a>
          ))}
        </nav>
      </div>
      <p className="mt-3">
        © {year} Årsredovisningar. {t("footer.copyright")}
      </p>
    </footer>
  );
}
