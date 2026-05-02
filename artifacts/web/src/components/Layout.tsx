import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { t, language, setLanguage } = useLanguage();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/demo", label: t("nav.demo") },
    { href: "/pricing", label: t("nav.pricing") },
  ];

  const isActive = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href));

  const toggleLang = () => setLanguage(language === "sv" ? "en" : "sv");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2">
                <div className="size-7 rounded-md bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-xs font-bold">Å</span>
                </div>
                <span className="font-semibold text-sm tracking-tight text-foreground hidden sm:block">
                  Årsredovisningar
                </span>
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive(link.href)
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleLang}
                aria-label={t("nav.lang.switch")}
                className="hidden sm:flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                {t("nav.lang.toggle")}
              </button>

              <Link href="/login">
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-sm">
                  {t("nav.login")}
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="hidden sm:inline-flex text-sm">
                  {t("nav.signup")}
                </Button>
              </Link>

              <button
                className="md:hidden p-1.5 rounded-md hover:bg-accent transition-colors"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Menu"
              >
                {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="mx-auto max-w-7xl px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-md text-sm font-medium ${
                    isActive(link.href)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 border-t border-border">
                <button
                  onClick={() => { toggleLang(); setMobileOpen(false); }}
                  className="w-full text-left rounded border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {t("nav.mobile.lang_switch")}
                </button>
              </div>
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <div className="block px-3 py-2 text-sm text-muted-foreground">{t("nav.login")}</div>
              </Link>
              <Link href="/signup" onClick={() => setMobileOpen(false)}>
                <Button size="sm" className="w-full">{t("nav.signup")}</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-muted/30 py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="size-5 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-[10px] font-bold">Å</span>
              </div>
              <span className="text-sm text-muted-foreground">Årsredovisningar</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {t("landing.trust")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
