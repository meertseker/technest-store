# Monitoring checklist: UptimeRobot + Sentry

Owner: E4. The lead creates the accounts (no engineer creates cloud resources).
Step-by-step setup in Turkish: `DEPLOY.md` section 9.

## UptimeRobot (free plan, 5-minute interval)

| # | Name | Type | URL | "Up" means | Why |
|---|---|---|---|---|---|
| 1 | Shop home | HTTP(s) GET | `https://technest.co.uk/` | 200 | Storefront + Caddy + Cloudflare |
| 2 | Checkout | HTTP(s) GET | `https://technest.co.uk/checkout` | status `404` (set "Up HTTP status codes" to `200-299,404`) | Without a cart the page answers 404 from inside the checkout layout, so middleware + CSP + render all ran; 5xx = broken |
| 3 | API health | Keyword GET | `https://api.technest.co.uk/health` | body contains `OK` | Medusa server process |

No monitor on the Stripe webhook URL: Medusa answers any POST to `/hooks/payment/stripe_stripe`
with 200 and checks the signature later in the worker, so a probe proves nothing and every probe
would queue a failing webhook event. Stripe itself emails the account owner when webhook
deliveries keep failing (Stripe Dashboard -> Developers -> Webhooks shows each attempt).

Alert contacts: the lead's email + the UptimeRobot mobile app. Alert after 2 failed checks
(10 minutes), so a deploy's restart doesn't page anyone.

Not covered by UptimeRobot (weekly manual check, `docker compose ps`):
- `worker` (no public URL): healthy = `/health` inside the container.
- `backup`: turns unhealthy when the last successful dump is older than 26 h.
- `photo-worker`: internal only; the product "Product photo" box shows "The photo worker is not responding. Try again in a minute." if it's down (and Quick add skips the photo step).

## Sentry (free plan, errors only)

| App | Project | Env var | What is captured |
|---|---|---|---|
| Backend (server + worker) | `technest-backend` (Node.js) | `SENTRY_DSN_BACKEND` → `SENTRY_DSN` in the container | Uncaught exceptions, unhandled rejections, API 5xx (via the error handler in `src/api/middlewares.ts`) |
| Storefront | `technest-storefront` (Next.js) | `SENTRY_DSN_STOREFRONT` (server), `NEXT_PUBLIC_SENTRY_DSN` (browser, build arg) | Server render / route handler errors (`onRequestError`), browser errors |

Off switch: `SENTRY_DSN` (backend, storefront server) or `NEXT_PUBLIC_SENTRY_DSN` (browser, build time)
unset or empty = the SDK is not even loaded (`require` / `import()` only after the DSN check). Dev and tests
never send anything. Unit tests prove it (`apps/backend/src/lib/monitoring/__tests__/sentry-init.unit.spec.ts`,
`apps/storefront/src/instrumentation.test.ts`).

Privacy (defence in depth):
1. Sentry v11 `dataCollection` (`SENTRY_DATA_COLLECTION`): no user info, cookies, bodies, query params,
   DB query data or stack-frame local variables; request headers limited to user-agent / content-type / accept.
   No `tracesSampleRate` (tracing off), no session replay.
2. Our `beforeSend` / `beforeBreadcrumb` scrubber `sentry-scrub.ts` (identical copies in
   `apps/backend/src/lib/monitoring/` and `apps/storefront/src/lib/monitoring/`; a backend unit test fails if they differ):
   - drops `request.cookies`, `request.data`, `request.query_string`, `request.env`, stack-frame `vars`,
     every request header except user-agent / content-type / accept / content-length / host, and user fields other than `id`;
   - filters values under sensitive keys anywhere in extra / contexts / tags / breadcrumb data
     (email, phone, names, company, address fields, postcode, city, card / cvc / expiry, password, token, secret,
     authorization, cookie, session, IP ...);
   - redacts in any text (messages, exception values, breadcrumbs, log params): emails, UK and international
     phone numbers, UK postcodes, Luhn-valid card numbers, Stripe `sk_` / `rk_` / `whsec_` / `*_secret_*` /
     `cs_` values, Bearer / Basic credentials, JWTs, session cookies, every query-string value, IPv4 addresses and
     `"first_name": "..."`-style fields in serialised JSON;
   - strips query strings and fragments from request URLs, transactions and navigation breadcrumbs.
   Each category has a unit test (`sentry-scrub.unit.spec.ts`).
3. `/checkout` (only Stripe may run there, and its CSP allows only `'self'` + Stripe in `connect-src`):
   the browser SDK is never initialised on a document loaded at `/checkout`, and if a page that started elsewhere
   ever reaches `/checkout` client-side, every event and breadcrumb is dropped there, so no request goes to
   Sentry from checkout. Entering and leaving checkout are full page loads by design. The SDK itself is a
   lazily loaded first-party chunk from our own origin, never a third-party script. We chose this over a
   same-origin tunnel route: a tunnel would add a public endpoint to maintain, and there is nothing to report
   from checkout that Stripe and the backend don't already see.
4. Sentry project settings: Data Scrubber on, "Prevent Storing of IP Addresses" on.

## Smoke test after enabling (lead, on staging)

- [ ] Backend: `docker compose exec server node -e "fetch('http://127.0.0.1:9000/health').then(r=>console.log(r.status))"` → 200
- [ ] Trigger a test error (connectivity only, bypasses our hooks):
      `docker compose exec server node -e "const S=require('@sentry/node');S.init({dsn:process.env.SENTRY_DSN});S.captureException(new Error('technest smoke test'));S.flush(5000)"`
      → the issue appears in `technest-backend`. 4xx responses are *not* reported by design.
- [ ] Check an event in Sentry: no email, phone, cookie or IP visible
- [ ] UptimeRobot: all 3 monitors green for 1 hour
