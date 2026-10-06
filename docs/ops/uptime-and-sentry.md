# Monitoring checklist: UptimeRobot, worker heartbeat, Sentry

Owner: E4. The lead creates the accounts (no engineer creates cloud resources).
Step-by-step setup in Turkish: `DEPLOY.md` section 9.

**All three parts are required before launch. None is optional.** Each covers a failure the others
cannot see:

| Part | Tells you | Without it |
|---|---|---|
| UptimeRobot (3 monitors) | the shop or the API is down | customers find out first |
| Worker heartbeat (`WORKER_HEARTBEAT_URL`) | the worker is down or stuck | orders are still taken, but payment capture, emails and Click & Collect expiry stop, and nothing says so |
| Sentry (`SENTRY_DSN_BACKEND`, `SENTRY_DSN_STOREFRONT`) | a job, a subscriber or an email failed | the only trace is a log line that rotates away |

## UptimeRobot (free plan, 5-minute interval)

| # | Name | Type | URL | "Up" means | Why |
|---|---|---|---|---|---|
| 1 | Shop home | HTTP(s) GET | `https://technest.co.uk/` | 200 | Storefront + Caddy + Cloudflare |
| 2 | Checkout | HTTP(s) GET | `https://technest.co.uk/checkout` | status `404` (set "Up HTTP status codes" to `200-299,404`) | Without a cart the page answers 404 from inside the checkout layout, so middleware + CSP + render all ran; 5xx = broken |
| 3 | API health | Keyword GET | `https://api.technest.co.uk/health` | body contains `OK` | Medusa server process |

A monitor on the Stripe webhook URL is optional: an unsigned POST to
`/hooks/payment/stripe_stripe` is answered 400 (the signature is checked on the server before
anything is queued), so a monitor that expects 400 shows the endpoint is up and queues nothing. Stripe itself emails the account owner when webhook
deliveries keep failing (Stripe Dashboard -> Developers -> Webhooks shows each attempt).

Alert contacts: the lead's email + the UptimeRobot mobile app. Alert after 2 failed checks
(10 minutes), so a deploy's restart doesn't page anyone.

Not covered by UptimeRobot:
- `worker` (no public URL): covered by the worker heartbeat below. `/health` is a fixed 200 and says nothing about whether background work runs.
- `backup`: turns unhealthy when the last successful dump is older than about 2 h. The signal that reaches a person is `BACKUP_HEARTBEAT_URL` (a healthchecks.io check, required): DEPLOY.md section 8.2.
- Background removal (fal.ai, hosted): nothing runs on the server. If fal is down, the key is wrong or the balance is empty, the product "Product photo" box shows the reason (for example "The photo service refused our account (check the key and the balance)") and the original photo is kept.

## Worker heartbeat (dead-man's switch, required)

What it is: every 5 minutes the worker's `worker-heartbeat` job puts an event on the event queue, and
the subscriber of that event requests `WORKER_HEARTBEAT_URL`. A ping therefore means the scheduler ran,
Redis took the event, and the event worker took it off the queue again: the same path an order's
payment capture and emails take. If the worker is down, cannot reach Redis, or is stuck behind one
event, the pings stop and the monitor raises the alarm. With `WORKER_HEARTBEAT_URL` unset the job does nothing.

Setup (the same healthchecks.io account as `BACKUP_HEARTBEAT_URL`, a second check):

1. healthchecks.io → **Add Check** → name `technest-worker`, schedule **Simple**, period **5 minutes**,
   grace time **15 minutes** (a deploy restarts the worker; three missed pings in a row is not a deploy).
2. Notification: the lead's email (and the mobile app or SMS if wanted).
3. Copy the ping URL into `/opt/technest/.env` as `WORKER_HEARTBEAT_URL=https://hc-ping.com/<uuid>` and run
   `docker compose up -d`. Treat the URL as a secret: whoever knows it can keep the check green. It is never logged.
4. Within 5 minutes the check turns green ("last ping: just now").

When the alarm goes off:

```bash
ssh deploy@SERVER_IP 'cd /opt/technest && docker compose ps && docker compose logs --tail 100 worker'
```

- `worker` not running or restarting: read the log, fix, `docker compose up -d worker`.
- `worker` running but the log repeats one event: it is stuck or far behind; `docker compose restart worker`.
- `redis` unhealthy: `docker compose logs --tail 50 redis` (memory or disk full).
- Orders placed while it was down are picked up afterwards: the capture-retry and payment-reconcile jobs
  take the payments, and the email-sweeper job sends the emails that failed.

Any other dead-man's-switch service works (Better Stack heartbeat, UptimeRobot heartbeat): it only has to
accept a plain GET and alert when none arrives for 15 minutes.

## Sentry (free plan, errors only, required)

| App | Project | Env var | What is captured |
|---|---|---|---|
| Backend (server + worker) | `technest-backend` (Node.js) | `SENTRY_DSN_BACKEND` → `SENTRY_DSN` in the container | Uncaught exceptions, unhandled rejections, API 5xx (via the error handler in `src/api/middlewares.ts`), and failed background work (table below) |
| Storefront | `technest-storefront` (Next.js) | `SENTRY_DSN_STOREFRONT` (server), `NEXT_PUBLIC_SENTRY_DSN` (browser, build arg) | Server render / route handler errors (`onRequestError`), browser errors |

Off switch: `SENTRY_DSN` (backend, storefront server) or `NEXT_PUBLIC_SENTRY_DSN` (browser, build time)
unset or empty = the SDK is not even loaded (`require` / `import()` only after the DSN check). Dev and tests
never send anything. Unit tests prove it (`apps/backend/src/lib/monitoring/__tests__/sentry-init.unit.spec.ts`,
`apps/storefront/src/instrumentation.test.ts`).

### Background failures (worker)

Subscribers and scheduled jobs catch their own errors, so Sentry's global handlers never see them.
They are reported explicitly (`apps/backend/src/lib/alerting`), each with a `source` tag and ids only:

| `source` tag | Means | What to do |
|---|---|---|
| `job:email-sweeper`, message "N emails are failing to send" | Emails have been failing for at least 15 minutes. They are retried for 24 hours with a growing wait. | Check Resend: API key, quota, domain status, status page. Nothing to resend by hand yet. |
| `job:email-sweeper`, message "giving up on an email" (tags `template`, `resource_type`, `resource_id`, `audience`) | One email was not sent after 24 hours of retries. | Open the order (or application, booking) by the id in the tags and contact the recipient another way. `audience: shop` means it was the shop's own alert. |
| `job:email-sweeper`, message "the mail server refused the start-up check" | After a start the worker could not log in to the mail server (wrong `SMTP_PASS`, host or port, or an outage). | Fix `.env`, `docker compose up -d`. No email is sent until then; failed ones are retried afterwards. |
| `subscriber:order-placed-capture`, `job:capture-retry` (tag `order_id`) | A delivery order's payment could not be taken. Retried with a growing wait; `gave_up: true` means it will not be tried again. | When given up: the order is unpaid. Do not ship; contact the customer. |
| `job:authorisation-release`, `cart-completion:release-hold` | A card hold could not be released. Retried hourly. | If it repeats for the same payment, release it in the Stripe dashboard. |
| `workflow:capture-order-payments` | A payment was captured but a later step failed. Not refunded automatically. | Retry the action in the admin, or refund from the order page. |
| `job:click-collect-lifecycle`, `job:payment-reconcile`, `job:technest-low-stock-digest`, `job:worker-heartbeat` | A scheduled job failed. It runs again on its schedule. | Read the error; act if it repeats. |
| `email:<event>`, `workflow:send-email`, `subscriber:<name>` | An email could not even be attempted (its data could not be loaded), or a subscriber failed. | Read the error; the tags name the template and the record. |

Alert rules in the `technest-backend` project (Alerts → Create Alert → Issues). Both are required,
because "emails are failing" is one issue that comes back, not a new issue each time:

1. **A new issue is created** → email the lead.
2. **The issue changes state from resolved to unresolved** → email the lead. Resolve an issue in Sentry
   once it is dealt with, so that its next occurrence alerts again.

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
- [ ] Worker heartbeat: the healthchecks.io check `technest-worker` is green. Then `docker compose stop worker`:
      the check goes red and the alert email arrives within about 20 minutes. `docker compose start worker`:
      green again within 5 minutes.
- [ ] A background failure reaches Sentry: on staging set a wrong `SMTP_PASS` and run `docker compose up -d worker`.
      Within about 10 minutes `technest-backend` shows "the mail server refused the start-up check" and the alert
      email arrives. Place a test order: 15 to 25 minutes later "emails are failing to send" appears. Put the
      right key back and run `docker compose up -d worker`: the order's emails arrive, once each, after a wait
      about as long as they had been failing (10 minutes at least, 4 hours at most).
