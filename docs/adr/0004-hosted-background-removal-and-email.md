# ADR 0004: Hosted background removal (fal.ai) and hosted email (Resend)

- Status: accepted (human lead)
- Date: 2026-10-02
- Deciders: human lead
- Supersedes: the "in-house worker" and "no third-party service for photos" parts of ADR 0003, and the
  self-hosted `mailserver` service (DEPLOY.md section 11 as it was before this date)

## Context

The first production plan put everything on one Hetzner box: the shop, our own `photo-worker`
(rembg + BiRefNet, 4 to 6 GB of memory) and our own mail server (docker-mailserver). That needed a 16 GB
server and a lot of setup that has nothing to do with selling: port 25 unblocking, IP reputation, reverse
DNS, DKIM keys, a 1.2 GB model image.

The lead decided on 2026-10-02 not to run a model or a mail server on the shop's box.

## Decision

1. **Background removal runs on fal.ai**: endpoint `fal-ai/birefnet/v2`, model "General Use (Heavy)", the
   same BiRefNet family as the photo-worker's default. `FalProvider`
   (`apps/backend/src/modules/photo/providers/fal.ts`) implements the `BackgroundRemovalProvider` interface
   from ADR 0003, so the workflow, the routes and the admin UI are unchanged.
   - Selected by `FAL_KEY`. `PHOTO_WORKER_URL`, when set, still selects our own worker and wins (local use
     and the integration tests). Neither set: photo processing is off with a reason, as before.
   - Only the photo is sent, as a JPEG copy of at most 2048 px. The key goes only to `fal.run`.
   - The request uses `sync_mode`, so fal answers inline and keeps no copy in its request history.
   - `refine_foreground` is off: we use the answer's alpha channel only. The product's pixels still come
     from the original, which is still kept as its own file. The "only the background may change" rule holds.
   - The answer must be a PNG with the shape of what we sent, or the photo is rejected.
2. **Email goes out through Resend over SMTP** (`smtp.resend.com:587`, STARTTLS, user `resend`, the API key
   as the password). Our `smtp` notification provider is unchanged: only the defaults in
   `docker-compose.yml` moved. Any SMTP provider works by overriding four values in `.env`.
   - Incoming mail (`hello@`, replies) is forwarded by Cloudflare Email Routing to the owner's mailbox.
     There is no mailbox on our server.
3. **Removed from production**: the `photo-worker` and `mailserver` services and their volumes, the
   `mail.` site in the Caddyfile, the photo-worker image build in `deploy.yml`.
4. **Kept in the repo**: `infra/photo-worker/` and `RembgHttpProvider`, for local work without a fal key
   and as the fallback if the hosted service ever has to be replaced. The licence guard
   (`scripts/check-no-bria.sh`) stays.

## Consequences

- The box needs about 8 GB at the main compose limits, or 4 GB with the small-box override
  (`infra/staging/docker-compose.staging.yml`), instead of 16 GB.
- Product photos leave our server for processing. They are pictures of stock, not personal data.
- Two new accounts and two secrets: `FAL_KEY` and the Resend API key (`SMTP_PASS`). A fal balance of zero
  or a wrong key stops photo processing (the admin shows the reason; originals are kept), not the shop.
- `GET /admin/photos/status` no longer proves the service is reachable when fal is used: it makes no
  network call. The first photo shows a bad key or an empty balance.
- With fal the model is always `birefnet-general`; `isnet-general-use` is refused. `PHOTO_MODEL` only
  matters for the photo-worker.
- Not verified yet: a real call against fal with the shop's key. The provider is unit-tested against the
  documented request and response shapes; the first real photo on staging is the end-to-end check.
