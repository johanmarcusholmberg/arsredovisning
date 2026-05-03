import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Building,
  Home,
  Settings,
  LogOut,
  Briefcase,
  ListChecks,
  FileText,
  Globe,
} from "lucide-react";
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppFooter } from "@/components/layout/AppFooter";
import { useLanguage } from "@/hooks/useLanguage";
import type { Language } from "@/i18n/strings";

/**
 * Compact language switcher rendered in the mobile top bar AND the sidebar
 * footer so logged-in users can change language without going back to the
 * marketing site. Persisted in the same `lang` localStorage key the
 * marketing artifact uses, so the choice follows the user across both apps.
 */
function ShellLanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className={`relative ${className ?? ""}`}>
      <Globe className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <label htmlFor="shell-language" className="sr-only">
        {t("common.language")}
      </label>
      <select
        id="shell-language"
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("common.language")}
      >
        <option value="sv">{t("common.language.sv")}</option>
        <option value="en">{t("common.language.en")}</option>
      </select>
    </div>
  );
}

export function SidebarLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const reportMatch = location.match(/^\/reports\/([^/]+)/);
  const activeReportId = reportMatch ? reportMatch[1] : null;

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("common.skip_to_content")}
      </a>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-border/50 bg-sidebar">
          <SidebarHeader className="p-4 flex items-center justify-between border-b border-sidebar-border/50">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-lg text-sidebar-foreground"
            >
              <Briefcase className="h-6 w-6 text-primary" />
              <span>Årsredovisningar</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-mono uppercase tracking-wider mt-4 px-4">
                {t("shell.nav.section")}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/"}>
                      <Link href="/">
                        <Home className="h-4 w-4" />
                        <span>{t("shell.nav.dashboard")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.startsWith("/companies")}
                    >
                      <Link href="/companies">
                        <Building className="h-4 w-4" />
                        <span>{t("shell.nav.companies")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {activeReportId && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-mono uppercase tracking-wider mt-4 px-4">
                  {t("shell.nav.active_report")}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={
                          location === `/reports/${activeReportId}/preview`
                        }
                      >
                        <Link href={`/reports/${activeReportId}/preview`}>
                          <FileText className="h-4 w-4" />
                          <span>{t("shell.nav.preview_export")}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border/50 space-y-1">
            {user && (
              <div className="px-2 py-1.5 mb-1">
                <p className="text-xs text-sidebar-foreground/50 truncate">
                  {user.email}
                </p>
              </div>
            )}
            <div className="px-2 mb-2">
              <ShellLanguageSwitcher />
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/launch-checklist"}
                >
                  <Link href="/launch-checklist">
                    <ListChecks className="h-4 w-4" />
                    <span>{t("shell.nav.launch_checklist")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/settings"}>
                  <Link href="/settings">
                    <Settings className="h-4 w-4" />
                    <span>{t("shell.nav.settings")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleLogout}
                  className="cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t("shell.nav.logout")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 border-b flex items-center px-4 md:hidden bg-background sticky top-0 z-10 gap-3">
            <SidebarTrigger />
            <span className="ml-2 font-bold flex-1">Årsredovisningar</span>
            <ShellLanguageSwitcher className="w-28" />
          </header>
          <div
            id="main-content"
            tabIndex={-1}
            className="flex-1 overflow-auto focus:outline-none"
          >
            <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full min-h-full flex flex-col">
              <div className="flex-1">{children}</div>
              <AppFooter />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
