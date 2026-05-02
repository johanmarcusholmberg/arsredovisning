/**
 * API Server entry point.
 *
 * Validates required environment variables at startup and fails fast with a
 * clear error message if any are missing. This prevents silent misconfigurations
 * that would only surface at request time.
 *
 * Required variables (server will not start without these):
 *   PORT         — TCP port to listen on (set by Replit workflow config)
 *   DATABASE_URL — PostgreSQL connection string (Replit built-in DB)
 *
 * Optional variables (features degrade gracefully when absent):
 *   SUPABASE_URL            — Supabase project URL (Auth + Storage)
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase admin key (Auth + Storage)
 *   SESSION_SECRET          — Express session signing secret
 *   STRIPE_SECRET_KEY       — Stripe payment processing (Phase 4)
 *   OPENAI_API_KEY          — AI provider (Phase 5)
 *   EXPORT_SERVICE_URL      — PDF/Word export service (Phase 7)
 *
 * See .env.example for the full list with annotations.
 */

import app from "./app";
import { logger } from "./lib/logger";

// ---------------------------------------------------------------------------
// Required environment variable validation
// ---------------------------------------------------------------------------

const REQUIRED_ENV_VARS = ["PORT", "DATABASE_URL"] as const;

for (const varName of REQUIRED_ENV_VARS) {
  if (!process.env[varName]) {
    logger.error(
      { missingVar: varName },
      `Required environment variable "${varName}" is not set. ` +
      "Add it to Replit Secrets and restart the server. " +
      "See .env.example for documentation.",
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Optional variable warnings (non-fatal)
// ---------------------------------------------------------------------------

const OPTIONAL_ENV_VARS: Array<{ name: string; feature: string }> = [
  { name: "SUPABASE_URL", feature: "Supabase Auth + Storage" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", feature: "Supabase Auth + Storage" },
  { name: "SESSION_SECRET", feature: "Express sessions" },
  { name: "STRIPE_SECRET_KEY", feature: "Stripe payments (Phase 4)" },
  { name: "OPENAI_API_KEY", feature: "AI assistance (Phase 5)" },
  { name: "EXPORT_SERVICE_URL", feature: "PDF/Word export (Phase 7)" },
];

for (const { name, feature } of OPTIONAL_ENV_VARS) {
  if (!process.env[name]) {
    logger.debug(
      { missingVar: name, feature },
      `Optional env var "${name}" not set — ${feature} will be unavailable`,
    );
  }
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const rawPort = process.env["PORT"];
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  logger.error({ rawPort }, `Invalid PORT value: "${rawPort}"`);
  process.exit(1);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info(
    {
      port,
      supabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      stripe: !!process.env.STRIPE_SECRET_KEY,
    },
    "API Server listening",
  );
});
