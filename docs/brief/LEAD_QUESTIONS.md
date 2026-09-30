# Lead questions

Open questions for the owner/lead. Each entry has the default that was chosen so work could continue.
Format: `Q<n> (<area>, <date>)`: question. **Default:** what we did.

## Cloud session 2026-09-30

- Q1 (process): `docs/brief/` (the four `E*_PROMPT.md` briefs and `TEAM_CHAT.md`) is not in the repository
  or on any branch, so the cloud session could not read it. **Default:** worked from `CLAUDE.md`,
  `docs/specs/design.md`, `docs/contracts/*`, ADRs, plans and branch history. Please commit the briefs
  under `docs/brief/` if later sessions should follow them word for word.
- Q2 (process): the cloud session may only push to `claude/peaceful-thompson-0ooaf0`. **Default:** all
  work was merged `--ff-only` into a local `main` and that exact history was pushed to
  `claude/peaceful-thompson-0ooaf0`. To publish it: `git push origin origin/claude/peaceful-thompson-0ooaf0:main`
  (a fast-forward of `main`).
- Q3 (tooling): the Medusa skills (`building-with-medusa`, ...) and `ui-ux-pro-max` are not installed in
  the cloud container. **Default:** used docs.medusajs.com and the installed `@medusajs/*` 2.21.2 source.
- Q4 (process): GitHub push was refused (403) until the lead reconnected the Claude GitHub App mid-session. **Default:** kept committing locally; pushed once access was restored.
- Q5 (ops/E4): Should browser Sentry run on /checkout through a same-origin tunnel? **Default:** no, Sentry is off on /checkout (CSP allows only Stripe).
- Q6 (ops/E4): Uptime monitor on the Stripe webhook? **Default:** no (Medusa returns 200 before verifying the signature); rely on Stripe's failure emails.
- Q7 (ops/E4): Should the restore drill start the worker? **Default:** no, only caddy, server and storefront (the worker's jobs could capture/cancel real payments).
- Q8 (trade/E1): Should production refuse to start without `TURNSTILE_SECRET_KEY`? **Default:** it starts, but every repair booking is refused and an error is logged.
- Q9 (trade/E1): Hide a "Trade" price list whose dates have passed? **Default:** only the list's active status is checked (it is created without dates).
- Q10 (trade/E1): Can a customer who was approved and later removed from the Trade group re-apply? **Default:** no, an approved application blocks new ones until staff change it.
- Q11 (infra/E4): Caddy `api.` block should overwrite `CF-Connecting-IP` (`header_up CF-Connecting-IP {client_ip}`) or the rate limit can be bypassed by clients that skip Cloudflare. **Default:** to be applied in the Caddyfile (see merge log).
- Q12 (photos/E4): Can the server give photo-worker 6 GB? **Default:** `birefnet-general` with a 6 GB limit (as required); fallback `PHOTO_MODEL=isnet-general-use` at 4 GB (measured 5-7 s, 2.1 GB).
- Q13 (photos/E4): Switch on gentle white-balance/brightness correction? **Default:** off, it would change the product's colours.
- Q14 (photos/E4): Small products are never enlarged (smaller output canvas instead); products under 600 px are rejected with "retake closer". OK? **Default:** yes.
- Q15 (photos/E4): Unapproved processed images stay in file storage (no cleanup job yet). **Default:** keep them.
- Q16 (preview): The lead asked for a live Vercel preview. **Default:** storefront on Vercel project `technest-store-preview` (protected by Vercel login), backend in a Vercel Sandbox that stops after <= 45 min on the Hobby plan (see `docs/preview-vercel.md`). For an always-on preview, can we run the Hetzner box as staging now (`docker-compose.staging.yml`)? The GitHub repo is public (the sandbox cloned it without credentials): should it be private?
