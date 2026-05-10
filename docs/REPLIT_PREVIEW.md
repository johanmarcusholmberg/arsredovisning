# Replit Preview — Multi-Artifact Routing

This project uses multiple frontend artifacts that the path-based reverse proxy
stitches together. In Replit preview both artifact workflows must be running
for end-to-end navigation to work.

## Artifacts and routes

| Artifact | Path prefix | What it serves |
|---|---|---|
| `artifacts/web` | `/` | Public marketing site, beta entry, landing/demo/pricing pages |
| `artifacts/arsredovisningar` | `/arsredovisningar/` | The product app — login, register, dashboard, reports, etc. |

## Login / signup redirect chain

The marketing site does **not** host its own login or registration pages.
Instead, `artifacts/web` exposes lightweight redirect routes that forward to
the product app:

| Public URL (in `artifacts/web`) | Redirects to (in `artifacts/arsredovisningar`) |
|---|---|
| `/login` | `/arsredovisningar/login` |
| `/signup` | `/arsredovisningar/register` |
| `/dashboard`, `/workspace`, `/workspace/*` | `/arsredovisningar/` |

The redirect is implemented by `<RedirectToApp>` in
`artifacts/web/src/components/RedirectToApp.tsx` and the target URLs are built
by helpers in `artifacts/web/src/lib/productAppUrl.ts`.

All header, mobile-menu, and demo-page CTAs (`Logga in`, `Skapa konto`, demo
signup banner, etc.) point at the local `/login` and `/signup` routes — never
directly at the cross-artifact path. This keeps the redirect logic in a single
place.

## Required workflows in Replit preview

Both of these must be running:

- `artifacts/web: web`
- `artifacts/arsredovisningar: web`

The other two workflows (`artifacts/api-server: API Server` and
`artifacts/mockup-sandbox: Component Preview Server`) are not needed just to
render the marketing site or the auth forms, but the API server is required
once a user actually signs in and the product app starts making API calls.

## Troubleshooting

### Symptom: 502 on `/login` or `/signup` in Replit preview

**Most likely cause:** the `artifacts/arsredovisningar: web` workflow is
stopped, so the proxy has no upstream to forward `/arsredovisningar/login`
to and returns 502 from the proxy layer.

**First step:** restart the workflow:

1. Open the Workflows panel.
2. Restart `artifacts/arsredovisningar: web`.
3. Wait for the Vite dev server to print `ready in …ms`.
4. Reload `/login` or `/signup`.

If the route still 502s after both workflows are confirmed running, check the
arsredovisningar workflow logs for a Vite or import error.

### Symptom: 404 page reading "Did you forget to add the page to the router?"

This is the `artifacts/web` SPA's NotFound component rendering for a path it
doesn't recognise. It usually means navigation landed in the web artifact at
a `/arsredovisningar/*` path (typically a stale link bypassing the redirect
chain). Check that the link in question targets `/login` or `/signup`, not
`/arsredovisningar/login` or `/arsredovisningar/register` directly.

## Production behaviour

In a Replit deploy each artifact is published as its own always-on service and
the proxy routes by path automatically, so the redirect chain works without
any manual workflow management. The 502 failure mode described above is
preview-only.
