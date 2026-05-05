import { useEffect } from "react";

interface RedirectToAppProps {
  to: string;
}

export function RedirectToApp({ to }: RedirectToAppProps) {
  useEffect(() => {
    // We need to escape the canvas/preview iframe wrapper, which is bound to a
    // single artifact and would 404 on cross-artifact paths. Strategy:
    //   1. If window.top is same-origin & reachable, navigate the top frame.
    //   2. Otherwise (cross-origin top), synthesize an <a target="_top"> click,
    //      which the browser routes to the top browsing context without
    //      requiring script access to a cross-origin window.
    //   3. As a last resort, fall back to navigating the current frame so at
    //      least *some* navigation happens.
    let navigated = false;
    try {
      const top = window.top;
      if (top && top !== window) {
        top.location.replace(to);
        navigated = true;
      } else if (top === window) {
        window.location.replace(to);
        navigated = true;
      }
    } catch {
      // Cross-origin window.top access — fall through to the anchor click.
    }
    if (!navigated) {
      const a = document.createElement("a");
      a.href = to;
      a.target = "_top";
      a.rel = "noopener";
      document.body.appendChild(a);
      try {
        a.click();
      } finally {
        a.remove();
      }
      // Final safety net so the user never gets stuck on the spinner.
      window.setTimeout(() => {
        if (window.location.pathname !== to.split("?")[0]) {
          window.location.assign(to);
        }
      }, 250);
    }
  }, [to]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        <span>Omdirigerar…</span>
      </div>
    </div>
  );
}
