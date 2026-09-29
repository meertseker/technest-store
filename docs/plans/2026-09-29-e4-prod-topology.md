# E4 plan: production topology (Hetzner CX43, Docker Compose)

Status: DRAFT. Owner: E4.
Facts are verified against docs.medusajs.com (deployment/general, build, installation), the dtc-starter repo and rembg v2.0.85.

## Versions (from dtc-starter)
@medusajs/* 2.21.2 · Next.js 15.5.24 · React 19 · pnpm 10 + Turborepo. Node **22** in all images (`node:22-bookworm-slim`, because sharp/libvips needs glibc for AVIF).

## Images (built in GitHub Actions, pushed to GHCR; nothing is built on the server)
| Image | Contents | Run as |
|---|---|---|
| `ghcr.io/<org>/technest-backend` | multi-stage: `pnpm install --frozen-lockfile` → `turbo run build --filter=backend` → copy **only** `apps/backend/.medusa/server` → `npm ci --omit=dev` there | uid 10001 `node` |
| `ghcr.io/<org>/technest-storefront` | Next.js `output: "standalone"` (E3: add it to next.config.js; HEADS-UP) → copy `.next/standalone`, `.next/static`, `public` | uid 10001 |
| `ghcr.io/<org>/technest-photo-worker` | python:3.11-slim + `rembg[cpu,cli]==2.0.85` + birefnet-general, birefnet-general-lite, isnet-general-use baked in (never bria) | uid 10001 |

The storefront's `NEXT_PUBLIC_*` values are inlined at build time, so they go in as **build args** (backend URL, publishable key, Stripe pk, base URL, region `gb`). The prod image and the staging image are built separately.

## Services (docker-compose.yml)
| Service | Image | Mode / env | Health | Limits | Exposed |
|---|---|---|---|---|---|
| caddy | caddy:2 | Caddyfile, volumes `caddy_data`, `caddy_config` | — | 256m | 80, 443 |
| server | backend | `MEDUSA_WORKER_MODE=server`, `DISABLE_MEDUSA_ADMIN=false` | `GET /health` → OK | 2g, 2 cpu | internal :9000 |
| worker | backend | `MEDUSA_WORKER_MODE=worker`, `DISABLE_MEDUSA_ADMIN=true` | no /health in worker mode (medusa#8825): `pgrep -f "medusa start"`-style process check | 2g, 2 cpu | none |
| storefront | storefront | `node server.js`, `HOSTNAME=0.0.0.0` | `GET /` (or an `/api/health` route from E3) | 1g, 1.5 cpu | internal :8000 |
| postgres | postgres:16-alpine | volume `pg_data` | `pg_isready` | 2g | none |
| redis | redis:7-alpine | `--appendonly yes --maxmemory-policy noeviction`, volume `redis_data` | `redis-cli ping` | 512m | none |
| photo-worker | photo-worker | `-t 1 --no-ui`, `OMP_NUM_THREADS=2` | `GET /api` | **4g, 2 cpu** | none |
| mailserver | docker-mailserver (E2 fills this in) | placeholder with `profiles: ["mail"]` until E2 is ready | E2 | 1g | 25/465/587 (E2) |
| migrate | backend | one-shot `profiles: ["ops"]`: `npx medusa db:migrate` | — | — | none |
| backup (own branch, e4/backups) | small alpine + postgresql16-client + rclone | cron 03:15 `pg_dump -Fc` → R2 `backups/`, 30-day lifecycle | — | 256m | none |

Memory budget: 2+2+1+2+0.5+4+1+0.25+0.25 ≈ 13 GB of 16 GB, leaving headroom for the OS and page cache.
All services use `restart: unless-stopped`, json-file logs capped at `max-size: 10m, max-file: 3`, and one internal network (Caddy is the only public entry point).

## Domains (Caddy + Cloudflare proxied, Full (strict) TLS)
- `technest.co.uk` → storefront:8000 (`www.` → 301 to apex)
- `api.technest.co.uk` → server:9000 (`/app*` → 301 to admin.)
- `admin.technest.co.uk` → server:9000, with `/` → redirect `/app`. The admin SPA and `/admin/*` + `/auth/*` API are then **same-origin**, so session cookies just work. `admin.backendUrl` is left as default (`/`). This avoids a separate `--admin-only` static build.
- CORS: `STORE_CORS=https://technest.co.uk`, `ADMIN_CORS=https://admin.technest.co.uk`, `AUTH_CORS=https://technest.co.uk,https://admin.technest.co.uk`.
- Caddy trusts the Cloudflare ranges through `trusted_proxies static …`. Stock Caddy has no `cloudflare` source, and that would need a plugin build. Re-check https://www.cloudflare.com/ips/ yearly.

## medusa-config.ts (E1)
Already done by E1 on main: `redisUrl`, `workerMode` from `MEDUSA_WORKER_MODE`, `admin.disable` from `DISABLE_MEDUSA_ADMIN`, the Redis event-bus, workflow-engine and locking modules (production only), and file-s3 for R2 when `S3_BUCKET` is set. Migrations run through the one-shot `migrate` compose service, so no `predeploy` script is needed.

## Deploy flow (deploy.yml; written but disabled until lead OK)
1. CI green on main → build 3 images (buildx cache in GHA) → push `:sha` + `:main`.
2. SSH (key in GH secret, `appleboy/ssh-action` pinned by SHA) → `cd /opt/technest && IMAGE_TAG=<sha> docker compose pull && docker compose run --rm migrate && docker compose up -d --remove-orphans`, then curl `https://api.technest.co.uk/health` with retries; if that fails, re-deploy the previous tag.
3. Trigger: `workflow_dispatch` only (staging/production environment with required reviewer) until the lead approves auto-deploy.

## Secrets (server `/opt/technest/.env`, chmod 600; never in git)
DATABASE_URL, POSTGRES_PASSWORD, REDIS_URL, JWT_SECRET, COOKIE_SECRET, S3_* (R2), STRIPE_* (E2), SMTP_* (E2), ANTHROPIC_API_KEY, SENTRY_DSN(s), R2 backup keys (a separate, write-only-ish token scoped to the backups bucket).

## Backups
- Nightly `pg_dump -Fc` → R2 bucket `technest-backups`, with an R2 lifecycle rule to delete after 30 days. Weekly Hetzner snapshot (the lead enables it in the console; it's a paid add-on of +20% of the server price, so the lead decides).
- Restore: `pg_restore --clean --if-exists -d technest`. The drill runs in week 6 on a fresh CX23, timed and posted.

## Monitoring
- Sentry (free tier): `@sentry/node` in the backend via instrumentation, `@sentry/nextjs` in the storefront. `sendDefaultPii:false`, and a `beforeSend` that strips emails, phone numbers, addresses, cookies, authorization headers and request bodies on /store/carts, /store/payment*, and /hooks/*.
- UptimeRobot (free, 5-min): `https://technest.co.uk/`, `https://technest.co.uk/checkout` (expect 200), `https://api.technest.co.uk/health` (keyword OK), `https://api.technest.co.uk/hooks/payment/stripe_stripe` (POST unsigned → expect 400/401 rather than 5xx; confirm the route path with E2).
