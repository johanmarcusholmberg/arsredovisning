import { Router, type IRouter, json, raw } from "express";

const router: IRouter = Router();

/**
 * Funnel analytics sink (P4-4).
 *
 * Accepts both `application/json` POSTs and `navigator.sendBeacon`
 * payloads (which arrive as `application/json` with `Blob` content but
 * may also slip through as raw bytes depending on the browser).
 *
 * Like the client-error sink, this route is unauthenticated — many of
 * the events we care about (demo_view, register_start) fire before the
 * user is logged in. We log via `req.log` so events appear in the same
 * pipeline as the rest of the server's structured logs; downstream
 * shipping to a real analytics store can grep on `analytics_event`.
 *
 * Always returns 204 to keep the client side dead-simple.
 */
router.post(
  "/events",
  json({ limit: "16kb" }),
  raw({ type: "application/octet-stream", limit: "16kb" }),
  (req, res) => {
    let body: Record<string, unknown> = {};
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      body = req.body as Record<string, unknown>;
    } else if (Buffer.isBuffer(req.body)) {
      try {
        body = JSON.parse(req.body.toString("utf8")) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }

    const event =
      typeof body.event === "string" ? body.event.slice(0, 64) : "unknown";
    const props =
      body.props && typeof body.props === "object"
        ? (body.props as Record<string, unknown>)
        : {};
    const path =
      typeof body.path === "string" ? body.path.slice(0, 256) : null;

    req.log.info(
      {
        analytics_event: event,
        props,
        path,
        ip: req.ip,
        ua: req.headers["user-agent"]?.toString().slice(0, 200) ?? null,
      },
      "analytics_event",
    );

    res.status(204).end();
  },
);

export default router;
