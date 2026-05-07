import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { getProductRegisterUrl } from "@/lib/productAppUrl";
import { track } from "@/lib/track";

const DISMISS_KEY = "demoBannerDismissed";

/**
 * Sticky bottom banner shown on /demo once the user has scrolled past the
 * 3rd carousel slide. Encourages conversion to a real signup.
 *
 * Visibility rules:
 *   - Hidden until the user scrolls below `revealAt` pixels.
 *   - Hidden permanently after the user dismisses it (per-browser, via
 *     localStorage). We don't try to gate by login state — this is the
 *     marketing artifact and has no auth context.
 *   - Re-checks scroll on every scroll event but cheaply (no rAF needed
 *     for a single boolean threshold).
 */
export function StickyDemoBanner({ revealAt = 800 }: { revealAt?: number }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const signupUrl = getProductRegisterUrl({ fromDemo: true });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
        return;
      }
    } catch {
      /* localStorage may throw in private modes — treat as not dismissed */
    }
    const onScroll = () => {
      setVisible(window.scrollY > revealAt);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [revealAt]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* swallow */
    }
  };

  if (dismissed || !visible) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(720px,calc(100vw-2rem))] animate-in fade-in slide-in-from-bottom-4 duration-300"
      role="region"
      aria-label={t("publicDemo.banner.title")}
    >
      <div className="rounded-xl border border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 shadow-lg p-3 sm:p-4 flex items-center gap-3">
        <p className="text-sm sm:text-base font-medium text-foreground flex-1">
          {t("publicDemo.banner.title")}
        </p>
        <Button
          asChild
          size="sm"
          className="gap-1 shrink-0"
          onClick={() => track("demo_signup_click")}
        >
          <a href={signupUrl} target="_top" rel="noopener">
            {t("publicDemo.banner.cta")}
            <ArrowRight className="size-3.5" />
          </a>
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("publicDemo.banner.dismiss")}
          className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
