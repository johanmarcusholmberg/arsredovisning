/**
 * Mirror of the marketing artifact's analytics helper (P4-4) for use in
 * the post-signup funnel. See `artifacts/web/src/lib/track.ts` for the
 * design rationale.
 */
export type TrackEventName =
  | "demo_view"
  | "demo_open_pdf"
  | "demo_signup_click"
  | "register_start"
  | "register_success"
  | "first_company_created"
  | "first_report_created";

export type TrackProps = Record<string, string | number | boolean | null>;

const ENDPOINT = "/api/events";

export function track(event: TrackEventName, props: TrackProps = {}): void {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    event,
    props,
    path: window.location.pathname,
    ts: new Date().toISOString(),
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      /* swallow */
    });
  } catch {
    /* swallow */
  }
}
