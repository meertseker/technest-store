# CLAUDE.md - Tech Nest Online

Tech Nest Online: a device-first accessories store with a trade counter and repair booking,
for Tech Nest (Unit 2A, Southwark Park Rd., London SE16 3TU). Built by four Claude Code engineers.

**Each engineer's full brief is in `../E{n}_*_PROMPT.md`** (E1 Platform, E2 Payments & Email,
E3 Storefront, E4 Admin & Ops). The brief overrides everything else, including this file.
The team channel is `../TEAM_CHAT.md` (append-only; see the brief, Part 1 section 9).
Generic Medusa starter conventions (code style, lint, commands) are in [AGENTS.md](./AGENTS.md).

## Stack

- pnpm 10 + Turborepo monorepo (fork of `medusajs/dtc-starter`)
- `apps/backend`: Medusa v2 (2.21.x), Node 22, Postgres 16, Redis 7 (Redis modules in production only)
- `apps/storefront`: Next.js 15 as shipped by the starter (do NOT upgrade to 16 before launch), React 19, TS strict, Tailwind, shadcn/ui
- Payments: Medusa Stripe provider (`pp_stripe_stripe`), Stripe Payment Element, `capture: false`
- Email: custom `smtp` notification provider (Nodemailer) -> Mailpit in dev, docker-mailserver in prod
- Photos: `photo-worker` (rembg + BiRefNet-general, never `bria-rmbg`) + `sharp`
- Files: local provider in dev, Cloudflare R2 via S3 provider in prod
- Hosting: one Hetzner box, Docker Compose, Caddy, Cloudflare. Images built by GitHub Actions -> GHCR.

## Commands

Use Node 22 (`fnm use 22`) and pnpm via corepack.

```bash
# once, from store/ (shared by all engineers - never stop it)
docker compose -f docker-compose.dev.yml up -d
bash scripts/dev-db.sh                       # creates technest_e1..e4

pnpm install
cd apps/backend && pnpm exec medusa db:migrate   # migrations + seed (first run)
cd apps/backend && pnpm dev                       # backend + admin on $PORT (900N), admin at /app
cd apps/storefront && PORT=800N pnpm dev          # storefront on 800N

cd apps/backend && pnpm exec medusa db:generate <module>   # after changing a custom module model
cd apps/backend && pnpm run build                          # type + lint check (required before merge)
cd apps/backend && pnpm run test:integration:http          # HTTP integration tests (needs Postgres)
cd apps/backend && pnpm run test:integration:modules
cd apps/backend && pnpm run test:unit
pnpm run lint
```

Per-engineer ports, databases and env files: [docs/local-setup.md](./docs/local-setup.md).

## Folder map

```text
store/
  apps/backend/
    medusa-config.ts          E1 (payment + notification sections: E2)
    src/modules/              custom modules: device, trade, repair, settings (E1); smtp provider (E2)
    src/links/                module links (E1)
    src/workflows/            workflows + steps (E1; collection workflows: E2)
    src/api/store|admin/      API routes (E1; Stripe webhooks: E2)
    src/subscribers/          event subscribers (emails: E2)
    src/jobs/                 scheduled jobs
    src/admin/                admin widgets and routes (E4)
    src/migration-scripts/    seed (E1)
    integration-tests/http/   HTTP integration tests
  apps/storefront/            E3 (checkout payment step: E2)
  packages/emails/            email templates (E2)
  docs/contracts/             API/event contracts between engineers
  docs/adr/                   architecture decision records
  docs/plans/                 implementation plans (Superpowers writing-plans)
  docker-compose.dev.yml      shared dev infra: Postgres 5432, Redis 6379, Mailpit 1025/8025 (E1)
  docker-compose.yml, Caddyfile, .github/workflows/, DEPLOY.md   production (E4)
```

## Domain rules (everyone)

- Money: our own values (settings, thresholds, events, contracts) are **integer pence (GBP)**.
  Medusa's pricing module stores prices **as-is in major units** (GBP 3.49 is stored as `3.49`) -
  never multiply by 100 when writing Medusa prices, never divide when reading them.
  Convert at the boundary and name pence fields `*_pence` or document them.
- Retail prices include VAT (region is tax-inclusive, 20% UK VAT). Trade prices are shown ex-VAT with a label.
- Show delivery cost on the product page and in the basket before checkout (no drip pricing).
- Only the signed Stripe webhook marks an order as paid. The browser never does.
- Capture: Stripe runs with `capture: false`. Delivery orders are captured right after `order.placed`.
  Click & Collect is captured when staff press "Collected". Uncollected after 7 days: cancel and release
  the authorisation. Reminder after 3 days.
- Stock: one stock location, "Tech Nest - Southwark Park Rd". Click & Collect via native pickup if
  available, otherwise a GBP 0 shipping option on that location.
- Add-on (GBP 1) items can't make up a delivery order on their own. Click & Collect is exempt.
- Vapes are never listed online. Chargers and power products need `safety_marking` (UKCA or CE) before publishing.
- Photos: only the background may change. Never generate or alter the product itself; always keep the original.
- Security: never log card data, Stripe secrets or customer PII. Never commit secrets. The only third-party
  script on `/checkout` is Stripe's.
- Accessibility: WCAG 2.2 AA, body text >= 16px, tap targets >= 44px, no CAPTCHA puzzles (Cloudflare Turnstile).
- Custom events use the `technest.` prefix; the event catalogue is in the brief, Part 1 section 5.

## Git workflow

- `store/` stays on `main`. Never code there, except for merges. Work in `../worktrees/eN` on branches `eN/<topic>`.
- Create your worktree: `git -C /c/Users/meert/Desktop/technest/store worktree add ../worktrees/eN -b eN/setup`
- Small commits and small branches (under ~400 changed lines where possible).
- Merging, one person at a time:
  1. Check `TEAM_CHAT.md` for an open `[MERGE-START]` without a `[MERGE-DONE]`. If there is one, wait.
  2. Post `[MERGE-START] eN/topic`.
  3. Rebase your branch on `main` in your worktree.
  4. Run typecheck, lint and tests.
  5. From `store/`: `git merge --ff-only eN/topic`.
  6. Post `[MERGE-DONE]` with what others must do (e.g. "pull main; run db:migrate").
- Run `/code-review` before every merge; also `/security-review` for payments, auth or webhooks.
- Never push to a remote, create cloud resources or deploy without the human lead's OK. Never force-push `main`.
- Never edit a migration after it has been merged. Add a new one.

## File ownership (post a `[HEADS-UP]` in TEAM_CHAT.md before touching someone else's)

| Area | Owner |
|---|---|
| `apps/backend/medusa-config.ts`, custom backend modules (`device`, `trade`, `repair`, product attributes, settings), seed scripts, `docker-compose.dev.yml`, root `CLAUDE.md` | E1 |
| Stripe config and webhooks, checkout payment step (`apps/storefront/src/modules/checkout/payment*`), notification provider `smtp`, `packages/emails`, all email subscribers, collection workflows and jobs, `mailserver` service in production compose | E2 |
| Everything else in `apps/storefront` (pages, layout, device picker, search UI, basket, checkout layout, accounts, legal pages, SEO, cookie banner) | E3 |
| `apps/backend/src/admin/**`, the `photo-worker` service and photo workflow, CSV import, `docker-compose.yml` (production), `Caddyfile`, `.github/workflows/**`, `DEPLOY.md`, backups and monitoring | E4 |

## Working rules

- Load the Medusa skills before coding: `building-with-medusa` (backend), `building-admin-dashboard-customizations`
  (admin), `building-storefronts` / `storefront-best-practices` (storefront), `db-generate`, `db-migrate`.
  For Medusa APIs trust the skills and https://docs.medusajs.com/llms.txt over memory.
- Module -> workflow -> API route. All mutations go through workflows with compensation. Only GET/POST/DELETE.
- Every API route and workflow needs an integration test.
- Don't claim something works unless you ran it. Report exact pass/fail results.
