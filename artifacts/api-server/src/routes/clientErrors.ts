import { Router, type IRouter, json } from "express";

const router: IRouter = Router();

/**
 * Client error sink (P3-1).
 *
 * The arsredovisningar React error boundary POSTs uncaught render-phase
 * errors here so they end up in the same `req.log` pino stream as the
 * rest of our server logs. The route is intentionally:
 *
 *  - Unauthenticated: errors must reach us even if the user's session
 *    is broken, which is often *why* the boundary fired.
 *  - Permissive about shape: the body is best-effort JSON; we never let
 *    a malformed payload generate another error.
 *  - Capped in size: 64 KB is far more than any sane stack trace, but
 *    small enough that a runaway client can't fill the log pipeline.
 *  - Always returns 204 so the client never retries.
 */
router.post(
  "/client-errors",
  json({ limit: "64kb" }),
  (req, res) => {
    const body =
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, unknown>)
        : {};

    // Truncate any stringy field defensively before logging.
    const truncate = (v: unknown, max: number): string | null => {
      if (typeof v !== "string") return null;
      return v.length > max ? `${v.slice(0, max)}…[truncated]` : v;
    };

    req.log.warn(
      {
        clientError: {
          name: truncate(body.name, 200),
          message: truncate(body.message, 500),
          stack: truncate(body.stack, 8000),
          componentStack: truncate(body.componentStack, 4000),
          url: truncate(body.url, 500),
          userAgent: truncate(body.userAgent, 300),
          ts: truncate(body.ts, 64),
        },
        ip: req.ip,
      },
      "client_error_reported",
    );

    res.status(204).end();
  },
);

export default router;
