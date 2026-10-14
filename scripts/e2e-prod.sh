#!/usr/bin/env bash
# Browser tests against production builds: the backend from `medusa build`, started with
# `medusa start`, on a fresh migrated + seeded database, and the storefront from `next build`
# (`next start`), driven by Playwright (E2E_PROD=1). Some bugs only exist in a production
# build (forms stuck on "Saving…"), which `next dev` never shows.
#
# The backend runs with NODE_ENV=development and no Stripe or Turnstile secrets, so the
# manual payment provider and the Turnstile bypass are on: no secrets are needed.
# Used by CI (job e2e-prod). Locally, through tools/heavy.sh, with a database of your own:
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/technest_e4_e2e BACKEND_PORT=9004 \
#     STOREFRONT_PORT=8104 bash scripts/e2e-prod.sh
# Env: DATABASE_URL (required; the database must exist and may be empty), REDIS_URL (unused:
# dev mode keeps Redis modules off), BACKEND_PORT (9000), STOREFRONT_PORT (8000),
# SKIP_BACKEND_BUILD=1 (reuse apps/backend/.medusa/server), E2E_SPECS (default below).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
: "${DATABASE_URL:?set DATABASE_URL}"
backend_port="${BACKEND_PORT:-9000}"
sf_port="${STOREFRONT_PORT:-8000}"
backend_url="http://localhost:$backend_port"
sf_url="http://localhost:$sf_port"
specs="${E2E_SPECS:-e2e/basket-checkout.spec.ts e2e/accounts-trade.spec.ts e2e/checkout-boundary.spec.ts}"
server_dir="$root/apps/backend/.medusa/server"
medusa="$root/apps/backend/node_modules/.bin/medusa"
log="${E2E_BACKEND_LOG:-$root/apps/backend/.medusa/e2e-backend.log}"
admin_email="e2e-admin-$(date +%s)@example.com"
admin_password="e2e-$(date +%s)-pass"

# Backend environment. Empty values on purpose: Medusa's loadEnv (dotenv) never overrides a
# variable that is set, so a developer's apps/backend/.env can't switch Stripe or S3 on here.
backend_env=(
  NODE_ENV=development PORT="$backend_port" DATABASE_URL="$DATABASE_URL"
  MEDUSA_BACKEND_URL="$backend_url" STORE_CORS="$sf_url" ADMIN_CORS="$backend_url"
  AUTH_CORS="$sf_url,$backend_url" JWT_SECRET=e2e COOKIE_SECRET=e2e SEED_DEMO_DATA=true
  STRIPE_API_KEY= STRIPE_WEBHOOK_SECRET= TURNSTILE_SECRET_KEY= S3_BUCKET= FAL_KEY=
  ANTHROPIC_API_KEY= SENTRY_DSN= WORKER_HEARTBEAT_URL= PHOTO_WORKER_URL= REDIS_URL=
  MEDUSA_WORKER_MODE=shared DISABLE_MEDUSA_ADMIN=false MEDUSA_DISABLE_TELEMETRY=true
)

step() { echo; echo "== $*"; }

if [ "${SKIP_BACKEND_BUILD:-}" != 1 ]; then
  step "backend: medusa build"
  (cd "$root" && pnpm --filter "./packages/**" build && pnpm --filter @technest/backend build)
fi
[ -d "$server_dir" ] || { echo "no backend build at $server_dir" >&2; exit 1; }

step "backend: migrate and seed"
(cd "$server_dir" && env "${backend_env[@]}" "$medusa" db:migrate)
(cd "$server_dir" && env "${backend_env[@]}" "$medusa" user -e "$admin_email" -p "$admin_password") >/dev/null

step "backend: medusa start on $backend_port (log: $log)"
(cd "$server_dir" && exec env "${backend_env[@]}" "$medusa" start) > "$log" 2>&1 &
backend_pid=$!
cleanup() { kill "$backend_pid" 2>/dev/null || true; wait "$backend_pid" 2>/dev/null || true; }
trap cleanup EXIT
for i in $(seq 1 90); do
  curl -fsS "$backend_url/health" >/dev/null 2>&1 && break
  kill -0 "$backend_pid" 2>/dev/null || { echo "backend exited:" >&2; tail -40 "$log" >&2; exit 1; }
  [ "$i" = 90 ] && { echo "backend not healthy after 180 s:" >&2; tail -40 "$log" >&2; exit 1; }
  sleep 2
done
echo "healthy"

step "publishable key (made by the seed)"
key="$(BACKEND="$backend_url" EMAIL="$admin_email" PASSWORD="$admin_password" node -e '
  const b = process.env.BACKEND
  ;(async () => {
    const auth = await fetch(b + "/auth/user/emailpass", { method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: process.env.EMAIL, password: process.env.PASSWORD }) })
    const { token } = await auth.json()
    const res = await fetch(b + "/admin/api-keys?type=publishable&limit=1",
      { headers: { authorization: "Bearer " + token } })
    const { api_keys } = await res.json()
    if (!api_keys?.[0]?.token) throw new Error("no publishable key")
    process.stdout.write(api_keys[0].token)
  })().catch((e) => { console.error(e.message); process.exit(1) })')"
echo "found"

step "storefront: next build + Playwright ($specs)"
cd "$root/apps/storefront"
# NODE_ENV stays unset: next sets it itself. Every NEXT_PUBLIC_* is given, so a developer's
# .env.local (read by playwright.config.ts for unset variables only) can't change the build.
# Turnstile: Cloudflare's public always-pass test site key (not a secret); the backend has no
# secret in development mode and lets the booking through.
env -u NODE_ENV \
  E2E_PROD=1 E2E_PORT="$sf_port" \
  NEXT_PUBLIC_MEDUSA_BACKEND_URL="$backend_url" NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY="$key" \
  NEXT_PUBLIC_BASE_URL="$sf_url" NEXT_PUBLIC_DEFAULT_REGION=gb NEXT_PUBLIC_STRIPE_KEY= \
  NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA NEXT_PUBLIC_SENTRY_DSN= NEXT_PUBLIC_IMAGE_HOSTNAME= \
  MEDUSA_BACKEND_URL="$backend_url" \
  pnpm exec playwright test $specs --workers=1 --reporter=list
