import { useEffect } from "react";

interface RedirectToAppProps {
  to: string;
}

export function RedirectToApp({ to }: RedirectToAppProps) {
  useEffect(() => {
    // Use window.top so we escape the canvas/preview iframe wrapper
    // (which is bound to a single artifact and would 404 on cross-artifact paths).
    // Falls back to window.location if top is cross-origin or unavailable.
    try {
      (window.top ?? window).location.replace(to);
    } catch {
      window.location.replace(to);
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
