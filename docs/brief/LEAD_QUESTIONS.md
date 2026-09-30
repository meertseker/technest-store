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
- Q11 (infra/E4): Caddy `api.` block should overwrite `CF-Connecting-IP` (`header_up CF-Connecting-IP {client_ip}`) or the rate limit can be bypassed by clients that skip Cloudflare. **Default:** applied (api. and storefront blocks).
- Q12 (photos/E4): Can the server give photo-worker 6 GB? **Default:** `birefnet-general` with a 6 GB limit (as required); fallback `PHOTO_MODEL=isnet-general-use` at 4 GB (measured 5-7 s, 2.1 GB).
- Q13 (photos/E4): Switch on gentle white-balance/brightness correction? **Default:** off, it would change the product's colours.
- Q14 (photos/E4): Small products are never enlarged (smaller output canvas instead); products under 600 px are rejected with "retake closer". OK? **Default:** yes.
- Q15 (photos/E4): Unapproved processed images stay in file storage (no cleanup job yet). **Default:** keep them.
- Q16 (preview): The lead asked for a live Vercel preview. **Default:** storefront on Vercel project `technest-store-preview` (protected by Vercel login), backend in a Vercel Sandbox that stops after <= 45 min on the Hobby plan (see `docs/preview-vercel.md`). For an always-on preview, can we run the Hetzner box as staging now (`docker-compose.staging.yml`)? The GitHub repo is public (the sandbox cloned it without credentials): should it be private?
- Q17 (attributes/E1): Vapes are detected by words in title, handle, tags and category (vape, e-cig, e-liquid, disposable pod), with no attribute flag. OK? **Default:** yes (ADR 0001 has no vape field).
- Q18 (attributes/E1): The core `POST /admin/product-categories/:id/products` route is overridden so adding products to a charger/power category re-checks `safety_marking`. OK? **Default:** yes (same body and response as core).
- Q19 (attributes/E1): Should moving a category under a charger/power parent re-check all its products? **Default:** not now; the next save of each product is checked (documented gap).
- Q20 (photos/E4): With photo processing switched off, an uploaded original is stored and then deleted when the provider refuses. Add a health-check step first? **Default:** no (would add up to 2 s and refuse jobs during brief worker restarts).
- Q21 (import/E4): Re-importing a live charger with `safety_marking=none`: hide it (draft) or fail the row? **Default:** set to draft with the warning "It was live before and is now hidden".
- Q22 (import/E4): For a SKU on a multi-option product, the import updates only price and stock; other filled columns are ignored with a warning. OK? **Default:** yes.
- Q23 (storefront/E3): Best sellers: there is no sales data yet. **Default:** a `best-sellers` collection when staff create one; until then the home section is labelled "New in".
- Q24 (storefront/E3): Categories have no images. **Default:** an icon per tile, or `metadata.image_url` if set on the category.
- Q25 (storefront/E3): Home product cards have no "Add" button (multi-variant products need a picker). **Default:** the whole card links to the product page.
- Q26 (storefront/E3): No static map image (needs a maps API key). **Default:** "Open in Google Maps" and "Call" buttons.
- Q27 (legal): Please confirm: legal business name, company number, VAT number, ICO registration number, contact email, courier, delivery times, repair guarantee period, Click & Collect hold period, Sentry data region. **Default:** highlighted "[to be confirmed]" placeholders; legal pages carry a draft banner and are noindex.
- Q28 (storefront/E3): The hero search button is dark, not brand red (only the primary action is red). **Default:** left dark.
- Q29 (storefront/E3): Google reviews JSON was exported on the lead's machine and could not be re-verified against Google here. **Default:** used as committed; please spot-check the three shown reviews.
- Q30 (emails/E2): Click & Collect metadata keys follow `click-collect.md` (`collection_code`, `ready_for_collection_at`, `collection_expired_at`) instead of the older `technest_*` names. **Default:** yes; `emails.md` updated.
- Q31 (emails/E2): The low-stock email reloads each variant's reorder level (product attribute, default 3) instead of trusting the job's `threshold`. **Default:** reload.
- Q32 (emails/E2): Only one low-stock digest per London day, even if a later run finds different items. **Default:** yes.
- Q33 (payments/E2): If releasing a Click & Collect card hold still fails after one retry: **Default:** log order/payment ids only (the bank drops the hold itself); no staff alert.
- Q34 (payments/E2): Uncollected after 7 days but already captured (a "Collected" press that failed part-way): **Default:** nothing cancelled or refunded automatically; warning logged for staff follow-up.
- Q35 (CI/E4): The full backend HTTP suite runs out of memory in one Jest process (`--runInBand`). **Default:** the merge gate and CI run each HTTP spec file in its own process with a 4 GB heap.
- Q36 (settings/E1): Free delivery is judged on the basket after discounts, including VAT (Medusa `item_total`). **Default:** yes.
- Q37 (settings/E1): The owner edits thresholds under Settings -> "Shop settings" (not a main-menu entry). **Default:** yes.
- Q38 (promotions/E1): Seeded automatic promotion `ADDONS-3-FOR-2` (buy 2 £1 add-ons, 3rd free, repeats up to 10 free items per basket), also created in production by the migration script. **Default:** yes.
- Q39 (promotions/E1): The promotion targets the "£1 Deals" category (promotion rules can't read product attributes) while the basket rule uses `is_addon_item`; staff must keep both in step. **Default:** yes, documented in `docs/contracts/basket-rules.md`.
- Q40 (stock/E1): Low stock = stocked minus reserved <= reorder level, checked at 08:00 London; unpublished products are excluded. **Default:** yes.
- Q41 (quick-add/E4): Quick Add sends photos to Claude (`claude-opus-5-5`) and needs `ANTHROPIC_API_KEY` in production (without it Quick Add works with no suggestions). It was tested only against a local stub. **Default:** key to be provided by the lead; 60 analyses per admin user per hour.
- Q42 (quick-add/E4): Suggested prices never fill the price field automatically (staff tap "Use £x"); a vape-looking product is refused even as a draft; UKCA/CE claims need an "I have checked the label" tick. **Default:** yes.
- Q43 (quick-add/E4): When photo processing is off, staff cannot yet approve the original photo as the product image. **Default:** not built; process once the worker runs.
- Q44 (catalogue/E3): Product pages show Standard £3.49 / Next-day £5.99 as storefront constants (Medusa only prices shipping for an existing cart) with "Your basket shows the exact delivery price before you pay". **Default:** constants; move into `/store/technest-settings` later if prices change often.
- Q45 (catalogue/E3): Default sort is "Featured" (in-stock first) because there is no sales data for "Best selling". **Default:** yes.
- Q46 (catalogue/E3): Filtered, sorted and search-result pages are noindex; no delivery-time promises on product pages until delivery times are confirmed. **Default:** yes.
- Q47 (checkout/E3): Click & Collect orders store the shop's address as the "delivery" address (customer's name) and a name+country billing address; delivery orders use the delivery address as billing. **Default:** yes (Stripe asks for whatever the card needs).
- Q48 (checkout/E3): The add-on notice says "Add another item, or choose free Click & Collect" (the spec's "Add £X more" has no defined X). **Default:** yes.
- Q49 (checkout/E3): Not built yet: "Add for £1" suggestion row in the basket drawer, payment-method icons (text line instead), bank holidays in delivery-date estimates. **Default:** follow-up work.
- Q50 (mail/E2): Where does `hello@technest.co.uk` live today? Pointing MX at our server moves all domain mail there. **Default:** our mailserver handles the domain; DEPLOY.md 11.4 shows creating/forwarding `hello@`; check before changing MX.
- Q51 (mail/E2): Staff read `orders@` via IMAPS 993 only; sending from a mail app would need 587/465 open. **Default:** not opened.
- Q52 (mail/E2): DMARC starts at `p=none` for 2-4 weeks, then `quarantine`. **Default:** yes.
- Q53 (payments/E2): Refunds are done only from the Medusa admin order page (Stripe-dashboard refunds don't sync back). Uncollected Click & Collect orders are cancelled, not refunded. **Default:** yes; to be covered in the owner walkthrough.
- Q54 (admin/E4): "Mark ready" on the Click & Collect board is one tap (it emails the code); only "Collected" asks for confirmation (it takes the payment). **Default:** yes.
- Q55 (admin/E4): The admin uses 44px buttons and 16px text (owner on a phone), overriding the Medusa admin's small defaults. **Default:** yes.
- Q56 (accounts/E3): Customers can't change their account email online ("call the shop"); "Change password" sends the reset email. **Default:** yes.
- Q57 (trade/E3): No Turnstile on the trade application form (applicants must be signed in; the API takes no token). **Default:** no Turnstile there.
- Q58 (repairs/E3): Repair time preference is an optional date plus morning/afternoon, sent as text (e.g. "Sun 4 Oct, morning"). **Default:** yes.
- Q59 (infra/E4): The storefront forwards the visitor's `CF-Connecting-IP` to the backend on repair bookings (per-visitor rate limit); Caddy must set that header, never trust the client's. **Default:** Caddy `header_up` (already on the `api.` block; add to the storefront block too).
- Q60 (search/E1): Products are searchable by the brand, series, model and aliases (e.g. "16 pro", model numbers) of the devices they are linked to, weighted between title and description. **Default:** yes.
- Q61 (emails/E2): Trade events send the customer email and the shop alert as two separate workflow runs. **Default:** keep one workflow per email (tests wait for background work via `integration-tests/helpers/background.ts`; new suites that trigger emails must use it).
- Q62 (payments/E2): The order button reads "Place order and pay £X" (UK rule: it must be clear the customer is paying). Click & Collect shows a note about the card hold and the 7-day release. **Default:** yes.
- Q63 (payments/E2): The Stripe path of the storefront payment step has not been run with real Stripe test keys (unit/component tests with Stripe mocked only; the Stripe e2e group is skipped unless `E2E_STRIPE=1` and a `pk_test_` key are set). **Default:** the lead runs `apps/storefront/e2e/README-payment.md` once test keys exist.
- Q64 (ops/E4): Fixed before launch: production compose didn't pass `TURNSTILE_SECRET_KEY` (every repair booking would be refused) and the storefront image didn't get `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; `.env.production.template` had the wrong photo model. The site key is now a GitHub repository **variable** per environment. **Default:** fixed on `e4/owner-docs`.
- Q65 (trade): Who enters trade tier prices in Medusa's "Trade" price list (VAT-inclusive, pounds)? **Default:** left to the owner; covered in walkthrough 06.
- Q66 (payments): If a delivery order's payment capture fails, how does the shop take payment again? **Default:** "don't ship, contact the customer" (walkthrough 08).
- Q67 (payments): Switch on Apple Pay / Google Pay in Stripe? **Default:** left open (DEPLOY.md 5.4).
- Q68 (admin/E4): New "Product details for Tech Nest" widget (side column) edits safety marking, £1 add-on flag, reorder level and the other attributes; empty optional fields clear the stored value. **Default:** yes.
