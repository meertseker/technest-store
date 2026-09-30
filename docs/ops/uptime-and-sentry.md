# Monitoring checklist: UptimeRobot + Sentry

Owner: E4. The lead creates the accounts (no engineer creates cloud resources).
Step-by-step setup in Turkish: `DEPLOY.md` section 9.

## UptimeRobot (free plan, 5-minute interval)

| # | Name | Type | URL | "Up" means | Why |
|---|---|---|---|---|---|
| 1 | Shop home | HTTP(s) GET | `https://technest.co.uk/` | 200 | Storefront + Caddy + Cloudflare |
| 2 | Checkout | HTTP(s) GET | `https://technest.co.uk/checkout` | 200 | The page that earns money; also catches CSP/middleware crashes |
| 3 | API health | Keyword GET | `https://api.technest.co.uk/health` | body contains `OK` | Medusa server process |
| 4 | Stripe webhook | HTTP(s) POST, empty body | `https://api.technest.co.uk/hooks/payment/stripe_stripe` | status `400` (set "Up HTTP status codes" to `200-299,400`) | An unsigned POST must be rejected by signature checks, never 5xx or 404 |

Alert contacts: the lead's email + the UptimeRobot mobile app. Alert after 2 failed checks
(10 minutes), so a deploy's restart doesn't page anyone.

Not covered by UptimeRobot (weekly manual check, `docker compose ps`):
- `worker` (no public URL): healthy = `/health` inside the container.
- `backup`: turns unhealthy when the last successful dump is older than 26 h.
- `photo-worker`: internal only; Quick Add shows "background removal unavailable" if it's down.

## Sentry (free plan, errors only)

| App | Project | Env var | What is captured |
|---|---|---|---|
| Backend (server + worker) | `technest-backend` (Node.js) | `SENTRY_DSN_BACKEND` → `SENTRY_DSN` in the container | Uncaught exceptions, unhandled rejections, API 5xx (via the error handler in `src/api/middlewares.ts`) |
| Storefront | `technest-storefront` (Next.js) | `SENTRY_DSN_STOREFRONT` (server), `NEXT_PUBLIC_SENTRY_DSN` (browser, build arg) | Server render / route handler errors (`onRequestError`), browser errors |

Privacy (defence in depth):
1. `sendDefaultPii: false` in both SDKs; no performance tracing, no session replay.
2. Our `beforeSend` / `beforeBreadcrumb` scrubbers (`apps/backend/src/lib/monitoring/sentry-scrub.ts`,
   storefront copy in `apps/storefront/src/lib/monitoring/sentry-scrub.ts`) remove cookies, request bodies,
   query strings, auth / publishable-key / Stripe-signature / client-IP headers, and user fields other than `id`, and
   redact emails, UK phone numbers, UK postcodes, card-like numbers and Stripe secrets in messages,
   exception values, breadcrumbs, extra/contexts/tags.
3. The browser SDK is **not** initialised on `/checkout` (only Stripe's script is allowed there).
4. Sentry project settings: Data Scrubber on, "Scrub IP addresses" on.

Empty DSN = SDK not loaded at all. Dev and tests never send anything.

## Smoke test after enabling (lead, on staging)

- [ ] Backend: `docker compose exec server node -e "fetch('http://127.0.0.1:9000/health').then(r=>console.log(r.status))"` → 200
- [ ] Trigger a test error: in Sentry → Project → "Send a test event" (or temporarily call an unknown admin route with a malformed body; 4xx is *not* reported by design)
- [ ] Check an event in Sentry: no email, phone, cookie or IP visible
- [ ] UptimeRobot: all 4 monitors green for 1 hour
