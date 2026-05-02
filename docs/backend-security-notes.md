# Backend Security Notes — Årsredovisningar

## Environment Variable Boundaries

The most critical security rule in this project is the separation of frontend-safe and server-only secrets.

### Frontend-safe (can be exposed to the browser)

These variables may be included in Vite builds and are visible in the browser bundle.

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key — has Row Level Security enforced |

> **Important:** Even though the anon key is public-safe, Row Level Security (RLS) policies in Supabase **must** be correctly configured. The anon key is not a substitute for proper RLS.

### Server-only (never exposed to the browser)

These variables must only be used in `artifacts/api-server` (the Express backend). Never import or reference them in frontend code or Vite config.

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role — bypasses RLS, admin-level access |
| `STRIPE_SECRET_KEY` | Stripe API secret — used for payment intent creation and subscriptions |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `AI_PROVIDER_KEY` | AI provider API key (OpenAI, Anthropic, etc.) |
| `EXPORT_SERVICE_KEY` | Export service API key (if using a third-party PDF/Word service) |
| `SESSION_SECRET` | Express session signing secret (already present in Replit Secrets) |

---

## Row Level Security (Supabase)

When Phase 2 begins and Supabase is connected:

- Enable RLS on **every** table.
- Default policy: deny all.
- Add explicit policies for authenticated users scoped to their own company data.
- Never use `service_role` key in frontend code — it bypasses all RLS.

Example RLS policy pattern (SQL):
```sql
-- Users can only read their own company's reports
CREATE POLICY "Users see own company reports"
ON annual_reports
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM company_members WHERE user_id = auth.uid()
));
```

---

## API Route Security

All sensitive Express routes must:

1. Verify the user's JWT from Supabase Auth before processing.
2. Never trust client-supplied `user_id` or `company_id` — always derive from the verified JWT.
3. Validate all input with Zod schemas (already set up in `lib/api-zod`).
4. Return generic error messages to the client (do not leak stack traces or DB errors).

---

## Stripe Webhook Security

Stripe webhooks must verify the `Stripe-Signature` header using `STRIPE_WEBHOOK_SECRET` before processing any event. Do not process webhook payloads without verification.

```typescript
// In the webhook route handler (server-side only)
const event = stripe.webhooks.constructEvent(
  rawBody,
  req.headers['stripe-signature'],
  process.env.STRIPE_WEBHOOK_SECRET
);
```

The webhook endpoint must receive the raw (unparsed) request body — do not run `express.json()` before it.

---

## File Upload Security (Phase 2.5)

If SIE files or other uploads are accepted:

- Validate file type and size before processing.
- Never execute uploaded file content.
- Store files in Supabase Storage with user-scoped access policies.
- Scan for malformed data before parsing.

---

## CORS

The Express API server is configured with `cors()` (open by default). Before production:

- Restrict CORS to the app's own domain only.
- Do not allow wildcard origins in production.

---

## Secrets Checklist

Before each phase, verify:

- [ ] No secrets are hardcoded in source files
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` imported in any file under `artifacts/mockup-sandbox` or any future frontend artifact
- [ ] `.env` files are in `.gitignore` (verify before connecting GitHub)
- [ ] All new environment variables are added to `docs/replit-setup-notes.md`
