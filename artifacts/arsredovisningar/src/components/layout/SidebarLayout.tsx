import { Link, useLocation } from "wouter";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Building, Home, Settings, LogOut, Briefcase, ListChecks } from "lucide-react";
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function SidebarLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-border/50 bg-sidebar">
          <SidebarHeader className="p-4 flex items-center justify-between border-b border-sidebar-border/50">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg text-sidebar-foreground">
              <Briefcase className="h-6 w-6 text-primary" />
              <span>Årsredovisningar</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-mono uppercase tracking-wider mt-4 px-4">Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/"}>
                      <Link href="/">
                        <Home className="h-4 w-4" />
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/companies")}>
                      <Link href="/companies">
                        <Building className="h-4 w-4" />
                        <span>Companies</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border/50 space-y-1">
            {user && (
              <div className="px-2 py-1.5 mb-1">
                <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
              </div>
            )}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/launch-checklist"}>
                  <Link href="/launch-checklist">
                    <ListChecks className="h-4 w-4" />
                    <span>Launch checklist</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/settings"}>
                  <Link href="/settings">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 border-b flex items-center px-4 md:hidden bg-background sticky top-0 z-10">
            <SidebarTrigger />
            <span className="ml-4 font-bold">Årsredovisningar</span>
          </header>
          <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
