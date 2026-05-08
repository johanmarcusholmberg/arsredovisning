import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";

interface LayoutProps {
  children: ReactNode;
}

const APP_LOGIN_URL = "/login";
const APP_SIGNUP_URL = "/signup";

export function Layout({ children }: LayoutProps) {
  const { t } = useLanguage();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/demo", label: t("nav.demo") },
    { href: "/pricing", label: t("nav.pricing") },
  ];

  const isActive = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <a href="#main-content" className="skip-link">
        Hoppa till huvudinnehåll
      </a>
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
              {/* Language selector intentionally moved to the footer.
                  Login / Signup remain in the header. */}
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex text-sm">
                <Link href={APP_LOGIN_URL}>{t("nav.login")}</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex text-sm">
                <Link href={APP_SIGNUP_URL}>{t("nav.signup")}</Link>
              </Button>

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
              <Link
                href={APP_LOGIN_URL}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm text-muted-foreground"
              >
                {t("nav.login")}
              </Link>
              <Button asChild size="sm" className="w-full">
                <Link href={APP_SIGNUP_URL} onClick={() => setMobileOpen(false)}>
                  {t("nav.signup")}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </header>

      <main id="main-content" className="flex-1">{children}</main>

      <SiteFooter />
    </div>
  );
}
