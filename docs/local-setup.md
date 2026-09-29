# Local setup (per engineer)

Four engineers run backends and storefronts at the same time on one machine. Each has their own
worktree, ports, database and untracked env files. Replace `N` with your engineer number (1-4).

| Engineer | Backend + admin | Storefront | Database | Redis DB index |
|---|---|---|---|---|
| E1 | 9001 | 8001 | `technest_e1` | 1 |
| E2 | 9002 | 8002 | `technest_e2` | 2 |
| E3 | 9003 | 8003 | `technest_e3` | 3 |
| E4 | 9004 | 8004 | `technest_e4` | 4 |

Shared dev services (from `store/docker-compose.dev.yml`, already running - never stop them):

- Postgres 16: `localhost:5432`, user `postgres`, password `postgres`
- Redis 7: `localhost:6379` (dev backends use in-memory modules; Redis is only for prod parity)
- Mailpit: SMTP `localhost:1025`, web UI http://localhost:8025

## 1. Toolchain

```bash
eval "$(fnm env --shell bash)" && fnm use 22     # Node 22 (system Node is 20)
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0         # pnpm 10.11.1 via corepack
node -v && pnpm -v
```

## 2. Worktree

```bash
git -C /c/Users/meert/Desktop/technest/store worktree add ../worktrees/eN -b eN/setup
cd /c/Users/meert/Desktop/technest/worktrees/eN
pnpm install
```

## 3. Backend env

```bash
cd apps/backend
N=2   # your engineer number
sed -e "s/900N/900$N/g; s/800N/800$N/g; s/technest_eN/technest_e$N/g; s|6379/N|6379/$N|" .env.template > .env
```

Check `PORT`, `DATABASE_URL`, `STORE_CORS`
and `AUTH_CORS` point at your own numbers.

## 4. Database, seed and admin user

```bash
cd apps/backend
pnpm exec medusa db:migrate                          # runs migrations and the seed (first run only)
pnpm exec medusa user -e admin@technest.local -p supersecret   # dev only
```

Get your publishable key (created by the seed):

```bash
docker compose -f /c/Users/meert/Desktop/technest/store/docker-compose.dev.yml exec -T postgres \
  psql -U postgres -d technest_eN -tAc "select token from api_key where type='publishable' limit 1"
```

Reset your own dev DB (only yours):

```bash
docker compose -f /c/Users/meert/Desktop/technest/store/docker-compose.dev.yml exec -T postgres \
  psql -U postgres -c "DROP DATABASE technest_eN WITH (FORCE)" -c "CREATE DATABASE technest_eN"
```

## 5. Storefront env

```bash
cd apps/storefront
sed -e "s/900N/900$N/g; s/800N/800$N/g" .env.template > .env.local
# then paste your publishable key into NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
```

## 6. Run

```bash
cd apps/backend && pnpm dev                 # http://localhost:900N, admin http://localhost:900N/app
cd apps/storefront && PORT=800N pnpm dev    # http://localhost:800N  (the port comes from PORT)
```

Default region is `gb`. Mail sent in dev shows up in Mailpit at http://localhost:8025.

## Troubleshooting

- `ENOSPC`: the C: drive is full. Tell the lead.
- Docker commands hang: Docker Desktop's engine is stuck. Tell E1 or the lead (a restart affects everyone).
- CORS errors: `STORE_CORS` / `AUTH_CORS` in your backend `.env` must include your storefront port.
- "publishable key" errors from the storefront: `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` is missing or from another DB.
