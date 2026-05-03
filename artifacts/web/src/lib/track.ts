/**
 * Lightweight client-side funnel analytics (P4-4).
 *
 * Posts to the api-server `/api/events` route which logs through `req.log`.
 * The helper is deliberately fire-and-forget:
 *   - Failures never throw or surface to the UI — analytics must not
 *     break the product.
 *   - Uses `keepalive: true` so the request still leaves the browser
 *     when the user is navigating away (e.g. clicking a link to /register).
 *   - Uses `sendBeacon` when available for the same reason.
 *
 * Known events:
 *   demo_view, demo_open_pdf, demo_signup_click,
 *   register_start, register_success,
 *   first_company_created, first_report_created
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
      /* swallow — analytics is best-effort */
    });
  } catch {
    /* swallow */
  }
}
