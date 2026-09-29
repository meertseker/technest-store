# Plan: store configuration and seed (E1, week 1)

Branch: `e1/store-config`

## Goal

Replace the starter's demo data (Europe/EUR, clothing) with Tech Nest's real store configuration and
~30 realistic sample products, so E3 and E4 build against real-shaped data.

## Decisions

- **Single region** "United Kingdom": `gb`, `gbp`, `is_tax_inclusive: true`, payment provider
  `pp_system_default` (E2 adds `pp_stripe_stripe`). Tax region `gb` with default rate 20% "UK VAT".
- **Store** "Tech Nest": only currency GBP (default, tax-inclusive), default sales channel.
- **Stock location** "Tech Nest – Southwark Park Rd", Unit 2A, Southwark Park Rd., London SE16 3TU, GB
  (from `google-business-profile/profile.json`).
- **Click & Collect uses Medusa's native pickup**: a fulfillment set with `type: "pickup"` on the shop
  location (the 2.21 admin shows pickup sets and "awaiting pickup" fulfilments). Shipping option
  "Click & Collect – Free in-store pickup", £0, type code `click-collect`.
- **Delivery**: fulfillment set `type: "shipping"`, service zone "United Kingdom" (gb). Options
  "Standard delivery" £3.49 (`standard`) and "Next-day delivery" £5.99 (`next-day`). Placeholders:
  `[LEAD?]` for real prices.
- Medusa prices are major units (3.49), not pence. See CLAUDE.md.
- **Categories** (nested): Phone Accessories (Cases, Screen Protectors, Chargers & Cables, Power Banks),
  Audio (Earphones, Headphones, Speakers), Gaming (Controllers, Headsets, Charging),
  Computer & Laptop (Cooling Pads, Keyboards & Mice, Hubs & Adapters), £1 Deals.
  Handles are stable slugs (`phone-accessories`, `chargers-cables`, `1-deals`, ...).
- **Product attributes** go provisionally in `product.metadata` (`is_addon_item`, `safety_marking`,
  `connector_a`, `connector_b`, `wattage`, `cable_length_m`, `platform`, `warranty_months`) and
  `variant.metadata.reorder_level`. The week-2 ADR makes the final call; the seed will follow it.
- Seed logic lives in `src/scripts/seed/` (pure data + one `seedTechNest(container)` function).
  The migration script `initial-data-seed.ts` calls it, so a fresh DB is seeded by `db:migrate`, and the
  integration test calls the same function on a throwaway DB.
- The search index (`src/search/helpers/pricing.ts`) becomes GBP-only.
- Drop `src/scripts/seed-demo-products.ts` (clothing demo).

## Test (integration:http, written first)

`integration-tests/http/store-config.spec.ts` runs `seedTechNest` and checks:

1. `/store/regions` returns exactly one region: GBP, `gb`, and tax-inclusive.
2. `/store/product-categories` has the 5 top-level categories and the expected children.
3. A cart in the UK region with a seeded product lists 3 shipping options: Click & Collect £0
   (pickup), Standard 3.49 and Next-day 5.99.
4. At least 30 published products, all with GBP prices; `£1 Deals` products have `is_addon_item`.
5. The chargers and power banks all carry `safety_marking`.

## Steps

1. `.env.test` (dev DB credentials only) so the test runner can create a temp DB.
2. Write the failing test.
3. Write the seed data and function; rewire the migration script; GBP-only search.
4. Run the test, lint and build; reset `technest_e1`, `db:migrate`, then smoke test the storefront on 8001.
5. `/code-review`, merge, `[MERGE-DONE]` ("reset your DB").
