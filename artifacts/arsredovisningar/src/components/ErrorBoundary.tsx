import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/hooks/useLanguage";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Top-level error boundary for the arsredovisningar app.
 *
 * Catches any uncaught render-phase errors, displays a localized recovery
 * card, and POSTs the error to `/api/client-errors` for server-side
 * logging via `req.log`. Failures of the POST itself are intentionally
 * swallowed — we never want the reporter to spawn another error.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Best-effort report. We don't await it (componentDidCatch isn't async)
    // and we don't surface failures back to the user; a sentry-like
    // pipeline would do this, but POSTing to our own /api/client-errors
    // route lets `req.log` collect it through the existing logging stack.
    try {
      // The /api path is served by the api-server through the shared
      // proxy, NOT under the artifact's BASE_URL prefix. Using BASE_URL
      // here would route to the static frontend and 404.
      void fetch(`/api/client-errors`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          name: error.name,
          stack: error.stack ?? null,
          componentStack: info.componentStack ?? null,
          url: typeof window !== "undefined" ? window.location.href : null,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
          ts: new Date().toISOString(),
        }),
        keepalive: true,
      }).catch(() => {
        /* swallow — never break the recovery UI */
      });
    } catch {
      /* swallow */
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    window.location.assign(`${baseUrl}/`);
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorBoundaryFallback
          error={this.state.error}
          onReload={this.handleReload}
          onHome={this.handleHome}
        />
      );
    }
    return this.props.children;
  }
}

function ErrorBoundaryFallback({
  error,
  onReload,
  onHome,
}: {
  error: Error;
  onReload: () => void;
  onHome: () => void;
}) {
  // We're inside <LanguageProvider>, so the hook is safe here.
  const { t } = useLanguage();
  const isDev = import.meta.env.DEV;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight">
                {t("error_boundary.title")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("error_boundary.body")}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={onReload} className="flex-1">
              {t("error_boundary.reload")}
            </Button>
            <Button onClick={onHome} variant="outline" className="flex-1">
              {t("error_boundary.home")}
            </Button>
          </div>

          {isDev && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                {t("error_boundary.details")}
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/40 p-3 text-[11px] leading-relaxed font-mono whitespace-pre-wrap">
                {error.name}: {error.message}
                {error.stack ? `\n\n${error.stack}` : ""}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
