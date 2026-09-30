# Temporary live preview on Vercel (NOT production)

Production stays as designed: one Hetzner box with Docker Compose, Caddy and Cloudflare (see `DEPLOY.md`).
This preview only exists so the owner can click through the storefront while it is being built.

| Part | Where | Notes |
|---|---|---|
| Storefront | Vercel project `technest-store-preview` (Hobby account), built from branch `claude/peaceful-thompson-0ooaf0`, root `apps/storefront` | Protected by Vercel Authentication (log in to Vercel to view). |
| Backend + admin | Vercel Sandbox `technest-backend` (lhr1, 2 vCPU / 4 GB), Postgres + Redis inside the sandbox, `medusa develop` on port 9000 | **Ephemeral.** A Hobby sandbox session stops after at most 45 minutes. When it stops, the storefront shows errors until the sandbox is started again. |

Demo data only: the seeded catalogue, Stripe not configured, emails go nowhere, dev secrets
(`preview-only-not-a-secret`). Never put real customer data or live keys into the preview.

## Restarting the backend

The sandbox is persistent (snapshot on stop), so a new session keeps the database. Each new session may
get a new public URL; if it changes, update `NEXT_PUBLIC_MEDUSA_BACKEND_URL` and `MEDUSA_BACKEND_URL` on the
Vercel project and redeploy. Inside the sandbox:

```bash
sudo pg_ctlcluster 18 main start && sudo redis-server --daemonize yes
cd /vercel/app && git pull && pnpm install --frozen-lockfile
cd apps/backend && pnpm exec medusa db:migrate && pnpm dev
```

## Why not keep this

Medusa needs a long-running server, Postgres, Redis, a worker and scheduled jobs (Click & Collect day-3/day-7
job, low-stock job). Vercel Functions are not a fit for that, and sandboxes are time-limited. A permanent
staging server should be the Hetzner box with `docker-compose.staging.yml`.
