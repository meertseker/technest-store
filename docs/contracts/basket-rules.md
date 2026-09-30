# Contract: basket rules, add-on promotion, search synonyms, low stock

Owner: E1. Consumers: E3 (basket/checkout notice, search), E2 (low-stock email), E4 (admin: promotions, attributes).
Status: **v1 (2026-09-30)**. Lands on `e1/basket-rules`.

Store routes need the `x-publishable-api-key` header (use the SDK: `sdk.client.fetch`).
Errors use Medusa's standard shape: `{ "type": "not_found" | "not_allowed" | ..., "message": string }`.

## 1. Add-on rule

> Add-on (£1) items can't make up a delivery order on their own. Click & Collect is exempt. (CLAUDE.md)

- **Add-on item:** a line item whose product has `product_attributes.is_addon_item = true`
  (docs/contracts/product-attributes.md; the owner sets it in the "Product details" widget).
  Not the price, not the "£1 Deals" category: a £1 product without the flag is a normal item, and a
  flagged product counts even if its price changes. Line items without a product are normal items.
- **Add-on only:** the basket has at least one item and every item is an add-on. An empty basket is not.
- **Click & Collect:** a shipping option in a `pickup` fulfillment set (as in click-collect.md), or
  with shipping option type code `click-collect`. Everything else (Standard, Next-day) is delivery.

### Read: `GET /store/carts/:id/basket-rules`

```ts
type BasketRules = {
  addon_only: boolean        // every item is an add-on (false for an empty basket)
  delivery_allowed: boolean  // = !addon_only. Click & Collect is always allowed
  message: string | null     // notice text when addon_only, else null
}
```

```json
200 { "basket_rules": { "addon_only": true, "delivery_allowed": false,
  "message": "£1 add-ons can't be delivered on their own. Add another item to your basket, or choose Click & Collect (free)." } }
```

Unknown cart -> 404 `not_found`. No PII in the response. Not cached: call it after each basket change
(or read it with the cart in the basket/checkout server components).

Storefront (E3): when `delivery_allowed` is false, show `message` in the basket and on the delivery step,
and disable (or hide) the delivery options, leaving Click & Collect selectable. The server enforces it anyway.

### Enforcement (server side)

| When | Hook | Result when broken |
|---|---|---|
| `POST /store/carts/:id/shipping-methods` with a delivery option | `addShippingMethodToCartWorkflow.hooks.validate` | 400 `{ "type": "not_allowed", "message": <same message> }` |
| `POST /store/carts/:id/complete` (e.g. the normal item was removed after choosing delivery) | `completeCartWorkflow.hooks.validate` | 400 `{ "type": "not_allowed", "message": <same message> }`; no order, no payment authorisation |

Fix for the shopper: add a normal item, or switch to Click & Collect (then re-initialise the payment
session, since the total changed). Code: `src/workflows/hooks/basket-addon-rule.ts`, `src/lib/basket-rules.ts`.

## 2. Add-on multi-buy promotion

Seeded by the migration script `seed-promotions` (runs once per database, after the initial seed;
idempotent: skipped if the code exists or the `1-deals` category is missing). Native Promotion module:

- Code `ADDONS-3-FOR-2`, **automatic** (no code to type), type `buyget`, status `active`.
- Buy 2 items from the **£1 Deals** category (`items.product.categories.id in [1-deals]`), get 1 more
  from it at 100% off. Repeats: 3 for £2, 6 for £4, ... up to 10 free items per basket. Mixed add-ons count.
- It's in the admin under Promotions: the owner can edit, deactivate or delete it (the seed won't re-create
  it while the code exists).
- Promotion rules can't read product attributes, so this uses the category, while the basket rule uses
  `is_addon_item`. Keep £1 Deals and the flag in step (the seed does).

Storefront: Medusa shows it as a cart promotion (`cart.promotions`, `discount_total`, item adjustments).
Suggested copy: "Any 3 £1 add-ons for £2".

**Free delivery is not a promotion.** It's the settings shipping price rule (docs/contracts/settings.md,
`free_delivery_threshold_pence`, on `e1/settings`): Standard delivery's price is £0 at or above the
threshold. Don't add a free-shipping promotion on top.

## 3. Search synonyms

`POST /store/search` (product index, Postgres provider) matches common shopper words. Medusa's search
module has no synonym setting, so each product document gets a searchable, non-retrievable `synonyms`
text field built at index time (`src/search/helpers/synonyms.ts`):

| Product text contains | Also findable as |
|---|---|
| charger (one way) | plug, adapter, power adapter, charging plug |
| cable / lead / wire / cord | each other |
| earphones / earbuds / headphones / in-ear | each other |
| case / cover | each other |
| screen protector / tempered glass / screen guard / glass protector | each other |
| iphone / apple | each other |
| galaxy (one way) | samsung |
| power bank / portable charger / battery pack | each other |
| usb-c / type c / type-c / usbc | each other |
| controller (one way) | gamepad, joypad, pad |

"Product text" is the title, description, option values, category names and tags. No storefront change:
the existing InstantSearch client (`match_strategy: "last"`) gets the matches. Changing the list changes the
index definition hash, so Medusa reindexes on the next boot.

## 4. Low-stock digest (for E2)

Scheduled job `technest-low-stock-digest` (`src/jobs/low-stock-digest.ts`): runs hourly and acts only in the
**08:00 Europe/London** hour (BST/GMT safe; Medusa's cron has no time zone). It emits **one**
`technest.inventory.low_stock` event per run, and **only when at least one variant is low**. Payload exactly as
docs/contracts/emails.md:

```ts
type LowStockItem = {
  variant_id: string        // "variant_01J..."
  sku: string | null
  title: string             // "Camera Lens Protector (Clear / iPhone 15 Pro)"; product title alone for a default variant
  stocked_quantity: number  // stocked units at "Tech Nest – Southwark Park Rd"
  threshold: number         // the reorder level compared against
}
emit("technest.inventory.low_stock", { items: LowStockItem[] })  // emptiest (available) first
```

- **Low** means `stocked - reserved <= threshold` at the shop's location: stock reserved by placed orders
  (e.g. Click & Collect waiting on the shelf) counts as gone. `stocked_quantity` in the payload is still the
  stocked number (the contract field), so an item can show `stocked_quantity` above `threshold`.
- **threshold** = the product's `product_attributes.reorder_level` (default 3). Products with no attributes row
  use env `LOW_STOCK_THRESHOLD` (integer >= 0), default 3.
- Only published products, only variants with `manage_inventory`, only variants with a level at the location.
- Run it by hand (e.g. from a script): `runLowStockCheck(container)` from `src/jobs/low-stock-digest.ts`.
