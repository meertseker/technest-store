# Lighthouse and accessibility gates, 2026-09-30 (E3, branch `e3/a11y-perf`)

Spec: `docs/specs/design.md` section 8. Lighthouse mobile >= 90 in all four categories on home,
category, product and checkout; axe 0 violations, tap targets >= 44px, body text >= 16px and no
horizontal scroll on every page at 375 and 1280.

## How it was measured

Production build of the storefront against the local backend (`localhost:9001`, dev seed data):

```bash
cd apps/storefront
pnpm run build && PORT=8018 pnpm start
# in another shell, from apps/storefront:
CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome bash scripts/lighthouse.sh lighthouse-out
```

`scripts/lighthouse.sh` runs, for each page:

```bash
npx --yes lighthouse@13.5.0 "http://localhost:8018<path>" \
  --form-factor=mobile \
  --only-categories=performance,accessibility,best-practices,seo \
  --chrome-flags="--headless=new --no-sandbox" \
  --output=json --output=html --output-path=lighthouse-out/<page> --quiet
```

Pages: `/`, `/c/phone-accessories/cases`, `/p/silicone-case-magsafe`, `/checkout`. For checkout the
script first creates a cart with one in-stock item through the Store API and sends it as the
`_medusa_cart_id` cookie (`--extra-headers`). Chrome drops that header when it follows a redirect,
so the old `/checkout` (which redirected to `/checkout?step=contact`) ended on `/basket`; the
"before" checkout figure below is therefore `/checkout?step=contact`
(`CHECKOUT_PATH="/checkout?step=contact" bash scripts/lighthouse.sh`).

Lighthouse 13.5.0, Chromium 141 headless, default mobile emulation (simulated throttling: Moto G
Power, 4x CPU slowdown, slow 4G).

## Results

Three runs per page and build (six for "before" home and category), median shown, all runs in
brackets. "Before" is `main` at `a6bf72d`;
"after" is this branch. Both were measured on the same shared 4-CPU container while other agents
were running tests, so single runs swing by up to 10 points; see "Reading the numbers honestly".

| Page | Build | Performance | Accessibility | Best practices | SEO | LCP (median) | CLS | TBT (median) |
|---|---|---|---|---|---|---|---|---|
| Home `/` | before | 92 (94, 88, 88, 91, 96, 93) | 100 | 100 | 100 | 3.1 s | 0.001 | 160 ms |
| | after | 93 (92, 95, 93) | 100 | 100 | 100 | 2.9 s | 0.001 | 170 ms |
| Category `/c/phone-accessories/cases` | before | 95.5 (97, 98, 96, 94, 95, 94) | 100 | 100 | 100 | 2.4 s | 0.001 | 140 ms |
| | after | 93 (90, 93, 95) | 100 | 100 | 100 | 2.8 s | 0.001 | 220 ms |
| Product `/p/silicone-case-magsafe` | before | 93 (93, 92, 94) | 100 | 100 | 100 | 2.8 s | 0.001 | 180 ms |
| | after | 97 (99, 97, 95) | 100 | 100 | 100 | 2.0 s | 0.001 | 160 ms |
| Checkout `/checkout?step=contact` | before | 98 (99, 97, 98) | 100 | 96 | **54** | 2.1 s | 0 | 110 ms |
| | after | 92 (83, 92, 93) | 100 | 96 | **63** | 2.9 s | 0 | 210 ms |
| Checkout `/checkout` (no redirect now) | after | 98 (96, 99, 98) | 100 | 96 | **63** | 2.3 s | 0 | 110 ms |

Earlier "before" runs taken while the container was busier (load average 3.5 to 4.5) scored lower:
home 81 to 89, category 84 to 97, product 88 to 98.

### Reading the numbers honestly

- **Performance is at or above 90 on the median of every page, before and after, but not on every
  single run** (one checkout run scored 83, one category run 90). The differences between the
  builds are inside the run-to-run noise of this container. What the branch changes
  measurably is bytes and requests, not the score: about 23 KB less JavaScript on every
  storefront page (Headless UI and Floating UI no longer load with the header), and a bare
  `/checkout` renders without the 307 round trip it used to make.
- **LCP is above the spec's 2.0 s target on most runs.** On a first visit the LCP element on
  category, product and checkout is the cookie banner text; on home it is the hero photo. Both are
  in the first HTML, and the observed (unthrottled) LCP is 0.2 to 0.3 s. The simulated figure is
  high because on `localhost` every script and the Inter font finish before first paint, so
  Lighthouse's model puts them all on the LCP path. Production behind Cloudflare will differ in
  both directions (real latency, but a CDN and HTTP/3); measure again with PageSpeed Insights once
  the site is live.
- **Checkout SEO stays below 90 on purpose.** `/checkout` is `noindex` and disallowed in
  `robots.txt`, and Lighthouse's "Page is blocked from indexing" audit alone costs about 37 points.
  The branch adds the missing meta description (54 -> 63); the rest cannot be won without letting
  search engines index checkout, which we should not do.
- **Checkout best practices is 96, not 100, only in this sandbox.** The one failing audit is
  "Browser errors were logged to the console": `https://js.stripe.com/clover/stripe.js` fails with
  `ERR_TUNNEL_CONNECTION_FAILED` because the container has no route to Stripe. It loads normally
  on a machine with internet access.
- Accessibility is 100 on every page before and after; the axe spec below is the stricter gate.

## What changed for the gates

- Mobile menu: a solid panel on Radix Dialog (the basket drawer's primitive) instead of the
  starter's translucent Headless UI popover. It no longer overflows at 375 (it did by 8px), its
  links are 48px tall (they were 39px), and Basket is out of the menu (spec 6: "the basket is
  never inside the hamburger").
- Mobile search dialog: moved to Radix Dialog too, so Headless UI and Floating UI no longer ship on
  every page. The search field still gets focus on open.
- `/checkout` without `?step=` renders the contact or delivery section in place instead of
  redirecting (`needsStepRedirect` in `src/lib/checkout/steps.ts`). The payment step keeps its
  explicit `?step=payment` URL, which E2's payment return and error links use.
- Checkout has a meta description.
- 404: all three not-found boundaries share one Tech Nest 404 with the header and footer: one h1,
  16px text and 44px links to home, search, devices and contact. The starter page failed colour
  contrast ("Go to frontpage") and had no header.
- Text size: form hints (checkout contact and delivery, device search), the PDP delivery note, the
  basket trust line, basket and checkout variant lines, and inline error messages went from 14px to
  16px. The starter's floating-label CSS (`input:not(:placeholder-shown) ~ label`) shrank the
  `/search` "Sort" label to 12px because hidden inputs come before it; it now applies only to the
  starter input's own label.
- 14px stays only where spec 3 allows it (captions, badges, legal footnotes), and those elements now
  carry `data-small-text`, so the e2e gate can tell small print from body text. E2's Klarna hint under the
  basket's checkout button ("Klarna is available on orders over £30", 14px) is wrapped as small
  print in `basket-summary.tsx`; E2 may prefer 16px instead.
- Found while testing, fixed: adding to the basket from the product page or a quick-add button now
  opens the basket drawer with the "Added to basket" toast (spec 7.4). The catalogue hook never
  sent the `technest:basket-added` browser event the drawer listens for.

## The e2e gate

`apps/storefront/e2e/quality-gates.spec.ts` visits every page at 375 and 1280 and asserts, for
each page, 0 axe violations (WCAG 2.0/2.1/2.2 A and AA tags), buttons, fields and non-inline links
in the header, main and open dialogs at least 44px tall (icon buttons also 44px wide), text at
least 16px (14px only inside `[data-small-text]`), and no horizontal scroll. It covers home,
category and subcategory, product, device pages, search (results and no results), basket (empty
and with items), the open basket drawer, the open mobile menu, checkout contact (clean and with
the error summary) and delivery, an order confirmation (a guest Click & Collect order placed
through the Store API with the manual provider), sign in, register, forgot and reset password, the
signed-in account pages, trade, trade apply (signed out and in), repairs, repair booking, about,
contact, all eight legal pages and the 404.

```bash
cd apps/storefront
pnpm run build && PORT=8018 pnpm start
E2E_PORT=8018 pnpm exec playwright test e2e/quality-gates.spec.ts
```

Result on this branch: 68 passed (34 checks at each of the two widths).
