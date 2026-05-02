import { useState, useEffect } from "react";
import { Link } from "wouter";
import { X, Menu, ChevronRight } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

export interface DrawerNavItem {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  href: string;
  isActive: boolean;
}

interface MobileWorkspaceDrawerProps {
  items: DrawerNavItem[];
  companyName: string;
  companyMeta: string;
  badge?: string;
}

export function MobileWorkspaceDrawer({ items, companyName, companyMeta, badge }: MobileWorkspaceDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    setIsOpen(false);
  }, [items]);

  return (
    <>
      <div className="md:hidden flex items-center gap-3 border-b border-border bg-background px-4 py-2.5">
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          aria-label={t("workspace.drawer.open")}
        >
          <Menu className="size-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{companyName}</span>
          {badge && (
            <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium bg-muted/50 text-muted-foreground shrink-0">
              {badge}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground truncate ml-auto hidden sm:block">{companyMeta}</span>
      </div>

      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label={t("workspace.drawer.title")}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative w-72 max-w-[85vw] bg-sidebar border-r border-border flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-sidebar-foreground">{companyName}</p>
                  {badge && (
                    <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium bg-muted/50 text-muted-foreground">
                      {badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-sidebar-foreground/60 mt-0.5">{companyMeta}</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                aria-label={t("workspace.drawer.close")}
              >
                <X className="size-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {items.map((item) => {
                const { Icon } = item;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors group ${
                      item.isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    }`}
                  >
                    <Icon
                      className={`size-4 shrink-0 ${
                        item.isActive
                          ? "text-primary"
                          : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70"
                      }`}
                    />
                    <span className="leading-tight">{item.label}</span>
                    {item.isActive && <ChevronRight className="size-3 ml-auto" />}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
