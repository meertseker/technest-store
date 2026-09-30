# Contract: trade accounts and trade pricing

Owner: E1. Consumers: E3 (trade application form, "my trade status", trade tiers on the product page),
E4 (admin review screen), E2 (trade emails, via events).
Status: **draft v1 (2026-09-30)**. Build against the shapes below. Any change is posted as `[CONTRACT]`.

All store routes need the `x-publishable-api-key` header (use the SDK: `sdk.client.fetch`).
Store trade routes also need a **logged-in customer** (session or bearer token). Without one: `401`.
All admin routes need an admin session or token.
Errors use Medusa's standard shape: `{ "type": "not_found" | "invalid_data" | "not_allowed" | "unauthorized", "message": string }`.
Validation errors (bad body/query) are `400` `{ "type": "invalid_data", "message": "..." }`.

## Types

```ts
type TradeApplicationStatus = "pending" | "approved" | "rejected"
type BusinessType = "sole_trader" | "partnership" | "limited_company" | "other"

type TradeApplication = {
  id: string                            // "tapp_01J..."
  customer_id: string                   // "cus_01J..."
  company_name: string
  vat_number: string | null             // normalised: upper case, no spaces, e.g. "GB123456789"
  companies_house_number: string | null // normalised: upper case, no spaces, e.g. "01234567", "SC123456"
  business_type: BusinessType
  contact: { name: string; phone: string; email: string }
  status: TradeApplicationStatus
  reason: string | null                 // set on rejection (shown to the customer), else null
  created_at: string                    // ISO 8601
  updated_at: string                    // ISO 8601
}
```

## Store API (E3)

### `POST /store/trade-applications`

Submit an application for the logged-in customer. The customer id comes from the session, never the body.

Body (unknown keys are rejected with `400`):

```json
{
  "company_name": "Acme Phones Ltd",
  "vat_number": "GB 123 4567 89",
  "companies_house_number": "01234567",
  "business_type": "limited_company",
  "contact": { "name": "Jane Smith", "phone": "020 7946 0000", "email": "jane@acme.test" }
}
```

| Field | Rules |
|---|---|
| `company_name` | required, 1–200 chars (trimmed) |
| `vat_number` | optional / `null`. After removing spaces and upper-casing: `^(GB)?(\d{9}\|\d{12})$` |
| `companies_house_number` | optional / `null`. After removing spaces and upper-casing: `^[A-Z0-9]{8}$` |
| `business_type` | required, one of `BusinessType` |
| `contact.name` | required, 1–200 chars |
| `contact.phone` | required, 5–40 chars, digits, spaces and `+()-` only |
| `contact.email` | required, valid email |

Response `200`: `{ "trade_application": TradeApplication }` with `status: "pending"`.

Errors:
- `400 invalid_data` "You already have a pending trade application" - one pending application per customer.
- `400 invalid_data` "Your trade account is already approved" - an approved application exists.
- A customer whose application was **rejected** may submit a new one.

Emits `technest.trade_application.created` `{ "id": "tapp_..", "customer_id": "cus_.." }`.

### `GET /store/trade-applications/me`

The logged-in customer's most recent application (by `created_at`).

Response `200`: `{ "trade_application": TradeApplication | null }` (`null` = never applied; not a 404).

### `GET /store/products/:id/trade-tiers`

Trade tier prices for one product, for **approved trade customers only** (customer in the "Trade" group).

- `401` not logged in. `403 not_allowed` "Trade pricing is only available to approved trade accounts".
- `404 not_found` product missing, unpublished or not in the publishable key's sales channel.

Response `200`:

```json
{
  "product_id": "prod_01",
  "currency_code": "gbp",
  "price_label": "ex VAT",
  "vat_rate_percent": 20,
  "variants": [
    {
      "variant_id": "variant_01",
      "sku": "CLEAR-CASE-IPHONE-16",
      "title": "iPhone 16",
      "retail_inc_vat_pence": 999,
      "tiers": [
        { "min_quantity": 1,  "max_quantity": 9,    "unit_price_ex_vat_pence": 625, "unit_price_inc_vat_pence": 750 },
        { "min_quantity": 10, "max_quantity": 49,   "unit_price_ex_vat_pence": 583, "unit_price_inc_vat_pence": 700 },
        { "min_quantity": 50, "max_quantity": null, "unit_price_ex_vat_pence": 500, "unit_price_inc_vat_pence": 600 }
      ]
    }
  ]
}
```

- Every variant of the product is listed (sorted by `variant_rank`, then title). A variant without trade prices has `tiers: []`
  (show retail only). `retail_inc_vat_pence` is the default GBP retail price, or `null` if the variant has none.
- `tiers` are sorted by `min_quantity`. `max_quantity: null` means "and above".
- Show `unit_price_ex_vat_pence` with the label "ex VAT" (`price_label`). The `inc_vat` value is what the basket charges.
- Money is integer pence. `unit_price_ex_vat_pence = round(unit_price_inc_vat_pence / 1.2)`.

## Trade pricing model (E4 admin, anyone entering prices)

- Customer group **"Trade"** (name is exact). Approving an application adds the customer to it
  (the approve workflow creates the group if it is missing).
- Price list **"Trade"**: type `override`, status `active`, rule `customer.groups.id = [<Trade group id>]`.
  Created empty and idempotently by the migration script `src/migration-scripts/trade-pricing.ts`
  (helper `ensureTradePricing(container)` in `src/scripts/seed/trade-pricing.ts`).
- Tiers are ordinary price-list prices with Medusa's `min_quantity` / `max_quantity`:
  `1–9` (`min_quantity: 1, max_quantity: 9`), `10–49` (`10, 49`), `50+` (`50`, no max).
  Add them with Medusa's price list API, e.g. `POST /admin/price-lists/:id/prices/batch`
  `{ "create": [{ "variant_id": "...", "currency_code": "gbp", "amount": 7.5, "min_quantity": 1, "max_quantity": 9 }] }`.
- **Amounts are stored VAT-inclusive, in major units** (GBP 7.50 is `7.5`), exactly like retail prices,
  because the UK region is tax-inclusive and Medusa decides tax inclusivity per region/currency, not per
  price list. A trade price of GBP 6.25 ex VAT is therefore entered as `7.5`. The store route converts to ex-VAT pence.
  Never multiply by 100 when writing Medusa prices.

## Admin API (E4)

### `GET /admin/trade-applications`

Query: `status?` (`TradeApplicationStatus`, may repeat), `limit?` (1–100, default 20), `offset?` (default 0),
`order?` (`created_at` | `-created_at` | `updated_at` | `-updated_at` | `company_name` | `-company_name`; default `-created_at`).

Response `200`:

```json
{ "trade_applications": [TradeApplication], "count": 12, "limit": 20, "offset": 0 }
```

### `GET /admin/trade-applications/:id`

Response `200`: `{ "trade_application": TradeApplication }`. `404` if missing.

### `POST /admin/trade-applications/:id/approve`

Body: none (`{}`). Adds the customer to the "Trade" group and sets `status: "approved"`, `reason: null`.
Response `200`: `{ "trade_application": TradeApplication }`.
`400 invalid_data` if the application is not `pending`. `404` if missing.
Emits `technest.trade_application.approved` `{ "id", "customer_id" }`.

### `POST /admin/trade-applications/:id/reject`

Body: `{ "reason": string }` (required, 1–1000 chars, trimmed). Sets `status: "rejected"` and `reason`.
Response `200`: `{ "trade_application": TradeApplication }`.
`400 invalid_data` if the reason is missing/blank or the application is not `pending`. `404` if missing.
Emits `technest.trade_application.rejected` `{ "id", "customer_id", "reason" }`.

## Events (E2 emails)

| Event | Payload |
|---|---|
| `technest.trade_application.created` | `{ id: string, customer_id: string }` |
| `technest.trade_application.approved` | `{ id: string, customer_id: string }` |
| `technest.trade_application.rejected` | `{ id: string, customer_id: string, reason: string }` |

Load the application (contact email etc.) with `query.graph({ entity: "trade_application", fields: ["*"], filters: { id } })`.
