/**
 * Compact in-app footer rendered at the bottom of the workspace shell.
 *
 * Notes:
 * - The legal pages live in the *marketing* artifact (mounted at "/"), so the
 *   links use plain anchors with absolute hrefs (e.g. "/privacy") to perform
 *   real cross-artifact navigation rather than wouter SPA routing inside
 *   `arsredovisningar` (which is mounted under "/arsredovisningar/").
 * - This artifact has no i18n library; copy is kept short and bilingual
 *   (Swedish first, English in parentheses where it adds clarity) to avoid
 *   introducing a second language system per the spec.
 * - Designed to stay visually quiet so it never competes with the active
 *   workflow (validation panels, export preview, etc.).
 */

const LINKS: ReadonlyArray<{ href: string; sv: string; en: string }> = [
  { href: "/privacy", sv: "Integritetspolicy", en: "Privacy" },
  { href: "/terms", sv: "Användarvillkor", en: "Terms" },
  { href: "/support", sv: "Support", en: "Support" },
  { href: "/security", sv: "Säkerhet", en: "Security" },
  { href: "/contact", sv: "Kontakt", en: "Contact" },
];

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className="mt-10 border-t border-border/60 pt-4 pb-2 text-xs text-muted-foreground"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-relaxed max-w-3xl">
          Årsredovisningar är ett digitalt stöd och ersätter inte professionell rådgivning.
          Användaren ansvarar för att den slutliga årsredovisningen är korrekt och uppfyller gällande regelverk.
        </p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1 shrink-0">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_top"
              rel="noopener"
              className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            >
              <span lang="sv">{link.sv}</span>
              <span className="sr-only"> / {link.en}</span>
            </a>
          ))}
        </nav>
      </div>
      <p className="mt-3">© {year} Årsredovisningar. Alla rättigheter förbehållna.</p>
    </footer>
  );
}
