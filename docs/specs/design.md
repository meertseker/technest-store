# Tech Nest storefront: design spec

Owner: E3 · Status: draft v1 (2026-09-29) · Target file: `docs/specs/design.md`

Sources: E3 brief (Part 2 design rules), research paper §6 and §11, `storefront-best-practices` skill, `ui-ux-pro-max` UX guidelines (2026-09-29 pass; its suggested green/orange palette, Rubik + Nunito Sans pairing and GSAP scroll reveal were rejected because they conflict with the brief's fixed brand red, single typeface and no-unneeded-JS rules), `google-business-profile/`.

## 1. Principles

1. Calm and premium, not a loud discount site. The page is white, and red is the only accent.
2. Every page has one primary action, and only that action is red.
3. Plain words, with icons always paired with a text label. No emojis in the UI.
4. Design at 375px first. Only two layout breakpoints matter: `md` 768px (tablet) and `lg` 1024px (desktop), and 1280px is the max content width.
5. Server components by default. Client JS only for: device picker, basket drawer, search autocomplete, filter sheet, variant picker, checkout forms, cookie banner.

## 2. Tokens (CSS variables in `globals.css`, mapped into Tailwind / shadcn)

shadcn uses its own variable names; we map ours onto them so shadcn components pick up the brand automatically. Values are hex here. If the starter's shadcn setup expects HSL/OKLCH, convert them without changing the colours.

| Token | Value | Use | Contrast on white |
|---|---|---|---|
| `--brand` (`--primary`) | `#D6001C` | Primary buttons, sale badge, logo, free-delivery bar fill | 5.4:1 (AA text) |
| `--brand-hover` | `#B00017` | Primary button hover/active | 7.4:1 |
| `--brand-foreground` | `#FFFFFF` | Text on red | 5.4:1 |
| `--brand-subtle` | `#FDECEE` | Sale badge background (small areas only) | – |
| `--background` | `#FFFFFF` | Page | – |
| `--surface` (`--muted`, `--card` alt) | `#F6F7F9` | Cards, image tiles, section bands, footer | – |
| `--surface-2` | `#EEF0F3` | Hover on surfaces, skeletons | – |
| `--border` / `--input` | `#E3E6EA` | Hairlines, card borders | decorative |
| `--border-strong` | `#6B7280` | Form field borders (≥3:1 non-text contrast, also on `--surface`) | 4.8:1 |
| `--foreground` | `#111827` | Body and headings (dark slate) | 17.7:1 |
| `--muted-foreground` | `#4B5563` | Secondary text, captions (never below 14px) | 7.6:1 |
| `--success` | `#166534` | "In stock", "Fits your device", completed steps (≥4.5:1 on `--success-subtle` too) | 7.1:1 |
| `--success-subtle` | `#E8F5EC` | Fit box background | – |
| `--warning` | `#92400E` | "Low stock", "Doesn't fit" icon/text | 7.1:1 |
| `--warning-subtle` | `#FEF3E2` | "Doesn't fit" box background | – |
| `--destructive` | `#B91C1C` | Form errors only (never reused as brand red) | 6.5:1 |
| `--ring` | `#1D4ED8` | Focus ring (blue, so it is visible next to red buttons) | 6.7:1 |

All ratios checked with a script (WCAG formula). Red text on `--brand-subtle` = 4.75:1 and red on `--surface` = 5.05:1, both pass.

Rules:
- **Red never carries meaning on its own**, and errors never use brand red. Errors use `--destructive` plus an icon and text.
- **Focus ring:** `outline: 3px solid var(--ring); outline-offset: 2px` on `:focus-visible` for every interactive element. Sticky header/bars get `scroll-padding-top`/`bottom` so focus is never hidden (WCAG 2.2 2.4.11).
- **Radius:** `--radius: 0.5rem` (8px) for buttons, inputs and cards; `9999px` for chips/badges. One radius, used everywhere.
- **Shadow:** none on cards (border only). `shadow-lg` only on overlays (drawer, sheet, popover, sticky mobile bar).
- **Spacing:** Tailwind 4px scale. Page gutter 16px (<768), 24px (768–1279), 32px (≥1280). Section gap 48px mobile, 80px desktop.
- **Motion:** 150–200ms ease-out; everything disabled under `prefers-reduced-motion`.
- **Dark mode:** not at launch (keeps QA and photo backgrounds simple).

## 3. Typography

One typeface: **Inter** (variable, `next/font/google`, `display: swap`, latin subset, self-hosted by Next). Atkinson Hyperlegible is the fallback choice if the lead prefers it, and swapping it is a one-line change. Prices use `font-variant-numeric: tabular-nums` (`.tabular-nums`).

| Style | Mobile (375) | Desktop (≥1024) | Weight | Line height | Use |
|---|---|---|---|---|---|
| Display | 32px | 48px | 700 | 1.1 | Home hero only |
| H1 | 28px | 36px | 700 | 1.2 | Page titles, PDP title |
| H2 | 22px | 28px | 600 | 1.25 | Section titles |
| H3 | 18px | 20px | 600 | 1.3 | Card group titles, drawer headings |
| Body-lg | 18px | 18px | 400 | 1.6 | Hero lead, PDP intro |
| Body | 16px | 16px | 400 | 1.6 | Default. **Nothing interactive or readable below 16px** |
| Small | 14px | 14px | 500 | 1.45 | Captions, badges, legal footnotes only |
| Price | 24px (PDP) / 18px (card) | 28px / 18px | 700 | 1.2 | tabular-nums |

Letter-spacing -0.01em on H1/Display. Max text width 68ch.

## 4. Core components (shadcn/ui unless noted)

| Component | Spec |
|---|---|
| Button primary | Red bg, white text, 48px tall (44px min), 16px/600, full width on mobile in forms and on the PDP |
| Button secondary | White bg, `--foreground` text, 1px `--border-strong` border |
| Button ghost/link | Slate text, underline on hover; used for "change", "Clear all" |
| Input / Select | 48px tall, 16px text (prevents iOS zoom), label above (never placeholder-only), error text below with icon |
| Chip | Filter chips and device chip: 40px tall + 4px hit padding = 44px, pill radius, surface bg |
| Badge | "£1", "Sale" (red subtle bg, red text 14px/600); "In stock" (success) |
| Product card | 1:1 image on `--surface`, title (2 lines max), price, fit badge if device set, "Add" button 44px. Whole card is the link except the Add button |
| Sheet | Basket drawer (right, 100% width <768, 420px ≥768), filter sheet (bottom <768) |
| Command | Search autocomplete |
| Accordion | PDP specs, FAQ |
| Sonner | Toasts ("Added to basket" plus the basket count `aria-live="polite"`) |
| Icons | `lucide-react`, 20/24px, `aria-hidden` with a visible label next to them |

## 5. Imagery

- **Products:** 1:1, the product on white/transparent (photo-worker output), shown on `--surface` tiles. `next/image` with AVIF/WebP, `sizes` set per layout, `loading="lazy"` below the fold, `priority` only for the LCP image.
- **Shop photos (real ones only).** The folder holds 10 photos, but **01, 03 and 04 are other businesses** (Eyamobile, Blue Tech, Pocketgeek), and **02 is Apple packaging**. Never use them. Use:
  - `photo_09` (red Tech Nest shopfront): shop strip, Contact/About, Click & Collect confirmation
  - `photo_06`, `photo_10` (stocked walls, controllers): home hero background (cropped, with a dark scrim for text contrast ≥4.5:1)
  - `photo_07`, `photo_08` (interior, aisles): About, repairs page, trade banner
  - `photo_05` (case wall): Cases category tile / device page header
- Resize the originals to ≤2400px long edge, AVIF quality ~55; hero ≤150KB at mobile size.
- No stock photography and no AI-generated shop imagery.

## 6. Global layout

### Header (sticky, 64px mobile / 72px desktop, white, bottom border)

```
375:  [≡] [TECH NEST logo]              [search icon] [basket(2)]
      [ Shopping for: iPhone 15 Pro · change        ]   <- device chip row, 44px, surface bg
1280: [TECH NEST] [Shop▾ Repairs Trade] [====== search ======] [Shopping for: iPhone 15 Pro · change] [Account] [Basket(2)]
```
- The basket is never inside the hamburger. The count is announced as a full phrase, not a bare number: a visually hidden `<span role="status" aria-atomic="true">2 items in your basket</span>`, and it is the only live region in the header.
- On mobile the search icon opens a full-screen Command dialog.
- With no device set, the chip reads "Choose your device" (a secondary style, not red).
- Skip link "Skip to content" as the first focusable element.
- Checkout uses a **minimal header**: logo + "Secure checkout" (lock icon) + "Back to basket". No nav, no search.

### Footer (surface bg)
Columns (stacked on mobile, 4 columns ≥1024): Shop (categories from backend) · Help (Delivery, Returns, Click & Collect, Contact, Accessibility) · Visit us (address, today's hours + full hours, phone as `tel:`, "Open in Google Maps") · Trade & repairs. Bottom row: legal business name, company/VAT number (`[LEAD?]`), legal links, payment method icons. All shop data comes from one `site-config.ts` generated from `profile.json`.

## 7. Page layouts

Notation: `[ ]` = block, top to bottom. Width 375 = single column, 16px gutter.

### 7.1 Home

**375px**
```
[Header + device chip]
[Hero: shop photo with scrim · H1 "Accessories that fit your phone" · lead · DEVICE PICKER card (Brand ▸ Series ▸ Model, search by name) · link "How do I find my model?"]
[Trust row: 3 icon+label items, horizontal scroll disabled, wrap: "Free Click & Collect" · "5.0 on Google" · "14-day returns"]
[Category tiles: 2-col grid, 6–8 tiles (from backend categories), 1:1 image + label]
[£1 Deals / Under £5: H2 + tabs (£1 | Under £5) + 2-col product grid (4 items) + "See all"]
[Best sellers: 2-col grid (4 items) + "See all"]
[Repairs CTA: surface band, photo_07, "Screen broken? Most repairs same day" + "Book a repair" (secondary button)]
[Reviews: "5.0 on Google · 30 reviews" + 3 review cards stacked (real text, author first name + initial, date, Google attribution) + "Read all reviews on Google" → Maps]
[Shop strip: photo_09, address, today's hours, "Free Click & Collect", Map link, Call button]
[Trade banner: "Buying for a business?" + "Apply for a trade account" (secondary)]
[Footer]
```

**1280px**
```
[Header one row]
[Hero 2-col: left 7/12 H1 + lead + device picker card; right 5/12 shop photo. Height ≤560px]
[Trust row: 3 items inline]
[Category tiles: 4 cols × 2 rows]
[£1 Deals: 4-col grid]  [Best sellers: 4-col grid]
[Repairs CTA 2-col: photo | text]  
[Reviews: 3 cards in a row + Google badge left]
[Shop strip 3-col: photo | address+hours | static map image + buttons]
[Trade banner full width]
[Footer 4-col]
```
Only one hero; no carousels. LCP element = hero H1/photo; photo `priority`, `fetchPriority="high"`.

Reviews rules: text copied exactly (emoji characters in review text are left as the reviewer wrote them, since editing them would be editing the review), no rating-only reviews, choose from the latest reviews by a fixed rule (newest with ≥60 characters), always show "Reviews from Google" and link to the Maps profile.

### 7.2 Category listing `/c/[...slug]`

**375px**
```
[Breadcrumbs (collapsed to "‹ Parent")]
[H1 + result count]
[Fits-your-device banner: "Showing items that fit iPhone 15 Pro · Show all" (toggle)]
[Sticky toolbar 52px: [Filters (3)] [Sort: Best selling ▾]]
[Active filter chips row (wrap) + "Clear all"]
[Grid 2-col, gap 12px, 24 per page]
["Load more" button + "Showing 24 of 86"]   (paginated URLs ?page=2 for SEO)
[Footer]
Filter = bottom Sheet (90vh): "Fits your device" first, then category facets with counts, sticky footer [Clear all] [Show 42 results]
```

**1280px**
```
[Breadcrumbs] [H1 + count]
[Left rail 264px: Fits your device (pinned first) · facets with counts · Clear all] | [Toolbar: chips + sort right] [Grid 4-col] [Pagination]
```
- Filters, sort and page live in the URL (`searchParams`), so back navigation and reload keep them. The page is server-rendered from the params.
- Empty state: "No cases for iPhone 15 Pro in this colour", with buttons "Clear filters" / "Show all devices" / "Ask the shop" (tel link).

### 7.3 Product page `/p/[handle]`

**375px**
```
[Breadcrumbs collapsed]
[Gallery: swipeable 1:1, dots + "1/5", thumbnails hidden]
[Title H1]
[Price (inc. VAT) + was-price/Sale badge; trade: tier table "ex VAT"]
[FIT BOX: green "✓ Fits your iPhone 15 Pro" (icon, not emoji) | amber "Doesn't fit your iPhone 15 Pro · See ones that do" | neutral "Check it fits: choose your device"]
[Stock line: "In stock · 12 available"]
[Variants: text buttons 44px (connector/length/colour swatch with label)]
[Quantity stepper 44px]  [Add to basket (primary, full width)]
[Delivery box: "Collect today from our shop, free (ready in 1 hour, open till 8pm)" · "Standard delivery £X.XX · free over £20" · "Next-day £X.XX, order by 2pm"]
[Complete your setup: horizontal list of 3–4 compatible items with Add buttons]
[Specs accordion: "In plain English" summary first, then full specs table]
[Returns & warranty accordion]
[Sticky bottom bar (appears when main Add button leaves viewport): price + Add to basket, padding-bottom env(safe-area-inset-bottom)]
```

**1280px**
```
[Breadcrumbs]
[2-col: Gallery 7/12 (main image + vertical thumbnails) | Buy box 5/12 sticky: title, price, fit box, stock, variants, qty+add, delivery box]
[Complete your setup: 4-col row]
[Specs 2-col: plain English | table]
```
JSON-LD: `Product` + `Offer` (price inc. VAT, GBP, availability) + `BreadcrumbList`. `AggregateRating` only once product reviews exist (Phase 2); Google shop reviews must not be marked up as product ratings.

### 7.4 Basket (drawer; `/basket` page as no-JS fallback and deep link)

**375px** (Sheet, full width)
```
[Header: "Your basket (3)"  [×]]
[Free-delivery bar: "You're £3.50 away from free delivery" + progress (red fill on surface track, role="progressbar" with aria-valuenow)]
[Add-on rule notice (amber, when applicable): "£1 items can't be delivered on their own. Add £X more, or choose free Click & Collect."]
[Line items: 72px thumb, title, variant, fit badge, price, qty stepper (44px), Remove link]
[Add-on suggestions: "Add for £1" horizontal row (compatible only)]
[Sticky footer: Subtotal (inc. VAT) · "Delivery from £X.XX / Click & Collect free" · [Checkout securely] (primary) · payment icons]
```

**1280px**: drawer 420px from the right, same content. `/basket` page: 2-col (items 8/12 | summary 4/12 sticky).

### 7.5 Checkout `/checkout`

Single page, 3 sections in order, each one collapses to a summary with an "Edit" link once done: **1. Contact** (email; "Have an account? Sign in" link) → **2. Delivery** (a choice first: *Collect from shop, free* | *Standard* | *Next-day*, with prices; the address is asked only for delivery: postcode + address fields with browser autocomplete tokens, UK postcode check (regex, then postcodes.io)) → **3. Payment** (E2's Stripe Payment Element component). The Place order button is inside E2's step.

**375px**
```
[Minimal header]
[Order summary collapsed bar: "Show order summary ▾  £23.47"]
[1 Contact] [2 Delivery] [3 Payment]
[Trust footer: secure payment, returns link, contact phone]
```

**1280px**
```
[Minimal header]
[2-col: steps 7/12 | order summary 5/12 sticky (items, subtotal, delivery, VAT included line, total)]
```
- Guest checkout by default; after the order: "Save your details? Create a password" on the confirmation page.
- Autocomplete attributes on all fields (`email`, `given-name`, `postal-code`, `address-line1`…). Never re-ask for data we already have (WCAG 3.3.7).
- Klarna messaging shows only when the basket is ≥£30 (E2 handles the logic; the layout reserves no space for it).
- CSP: Stripe is the only third-party script (agreed with E2). No analytics on `/checkout`.

### 7.6 Order confirmation (brief, same grid)
H1 "Thanks, your order is placed" + order number + email sent to. Click & Collect: photo_09, address, **today's hours**, map link, "We'll email you when it's ready". Delivery: expected date. Then the summary and the account-creation offer.

## 8. Accessibility and quality gates
- WCAG 2.2 AA. Playwright + `@axe-core/playwright` test per page (0 violations), at 375 and 1280.
- Tap targets ≥44px with **≥8px between adjacent targets**; body text ≥16px.
- Forms: visible labels, inline errors linked with `aria-describedby`, and on a failed submit a **focusable error summary** at the top (`role="alert"`, `tabindex="-1"`, heading "There is a problem", each item links to its field). Focus moves to it once per submit, never on blur.
- Mobile keyboards: `type="email"`; `type="tel"` + `autocomplete="tel"`; postcode `autocomplete="postal-code"` + `autocapitalize="characters"`; quantity `inputmode="numeric"`.
- Filter and chip rows wrap (never a clipped single row).
- Interactive elements get `cursor-pointer` and 150–200ms colour transitions. No scroll-reveal or entrance animations (they cost client JS and CLS).
- Test widths: 375, 768, 1024, 1280 and 1440 (layout must still centre at 1440 with max-width 1280).
- No CAPTCHA puzzles (Turnstile on repair/trade forms only).
- Lighthouse mobile ≥90 on home, category, product and checkout; LCP <2.0s, CLS <0.05 (all images have width/height, fonts via `next/font`), INP <200ms.

## 9. Open points
- `[LEAD?]` Inter (default) vs Atkinson Hyperlegible.
- `[LEAD?]` Legal business name, company number, VAT number for the footer.
- `[LEAD?]` A vector logo. Until then: a wordmark "TECH NEST" in Inter 800 red, styled after the sign.
- Photos: permission to use the Google-profile photos on the site (they are the owner's shop, but some may be customer uploads). Better photos of the shop would help.
- Money: the brief says integer pence, while Medusa v2 stores prices in major units (4.99). The storefront formats whatever the API returns with `Intl.NumberFormat('en-GB', {style:'currency', currency:'GBP'})` and never divides by 100. Asked E1 to confirm.

## 10. Fitting this onto the dtc-starter (checked 2026-09-29)

- **Versions:** Next 15.5.24, React 19.0.5, **Tailwind v3** (`tailwind.config.js`) with `@medusajs/ui-preset`. Keep v3 (no upgrade before launch). shadcn/ui is installed in its Tailwind-v3 mode (`tailwind.config.js` + CSS variables in `globals.css`). Our tokens are mapped into Tailwind `colors` (`brand`, `surface`, `success`…). The Medusa UI preset stays for now so the starter's untouched components keep working, and it gets removed once no component imports `@medusajs/ui`.
- **Routes:** the starter nests everything under `/[countryCode]/`. We are UK only, so the segment is removed: `/`, `/c/[...slug]`, `/p/[handle]`, `/devices/[brand]/[model]`, `/search`, `/basket`, `/checkout`, `/order/[id]/confirmed`, `/account/...`, `/repairs`, `/trade`, `/about`, `/contact`, `/legal/[slug]`, `/welcome`. The region is resolved server-side from the GB region (cached), not from the URL.
- **next.config.js:** `images.unoptimized` goes **off** (AVIF/WebP, required for LCP), `typescript.ignoreBuildErrors` goes **off** (strict), and we add security headers (CSP for `/checkout` agreed with E2) plus `output: "standalone"` (E4). The image `remotePatterns` cover the R2 public host and localhost:9003.
- **Fonts:** Inter is already the Tailwind `sans` family, but it isn't loaded. Load it with `next/font/google` (variable) on `<html>`.
- **Search:** the starter ships `/store/search` + `@medusajs/instantsearch-adapter` (`src/lib/search-client.ts`). We reuse it for autocomplete and listing facets. The index needs GBP prices and synonyms (E1).
