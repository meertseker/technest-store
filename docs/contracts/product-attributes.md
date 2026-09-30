# Contract: product attributes

Owner: E1 (ADR 0001). Consumers: E4 ("Product details" widget, CSV import), E3 (filters, PDP, add-on badge).
Status: **v1 (2026-09-30)**. Lands on `e1/product-attributes`.

## Type

```ts
type SafetyMarking = "UKCA" | "CE" | "none"
type Platform = "ps5" | "ps4" | "xbox-series" | "xbox-one" | "switch" | "switch-2" | "pc" | "mac"

type ProductAttributes = {
  connector_a: string | null      // e.g. "USB-C", "Lightning", "USB-A"
  connector_b: string | null
  wattage: number | null          // W
  cable_length_m: number | null   // metres
  platform: Platform[]            // default []
  is_addon_item: boolean          // default false. £1 / add-on items (basket rule)
  safety_marking: SafetyMarking   // default "none"
  warranty_months: number | null
  reorder_level: number           // default 3; applies to each variant (08:00 low-stock digest)
}
```

A product with no stored row has all defaults. Responses always contain every key.

## Admin (E4)

- `GET /admin/products/:id/attributes` -> `200 { "product_attributes": ProductAttributes }`; unknown product -> 404.
- `POST /admin/products/:id/attributes` (partial; any subset of the keys) -> `200 { "product_attributes": ProductAttributes }`.
  Validation: `wattage`, `cable_length_m` >= 0; `warranty_months`, `reorder_level` integers >= 0; unknown keys -> 400.
  Setting `safety_marking: "none"` on a PUBLISHED charger/power product -> 400 `invalid_data` (rolled back).

## Store (E3)

Query the link on product routes: `GET /store/products?fields=+product_attributes.*`
(also on `/store/devices/:slug/products`). `product.product_attributes` is `null` when no row exists:
treat null as all defaults.

## Publish guard (everyone)

Every product create/update (admin UI, API, CSV import) is checked after the write; a failure rolls it back
with 400 `invalid_data` and a readable message:
- Published products in **Chargers & Cables**, **Power Banks** or **Gaming > Charging** (and their child
  categories) need `safety_marking` UKCA or CE.
  Message: `"<title>" is a charger or power product, so it needs a safety marking (UKCA or CE) before it can be published. Set "Safety marking" in the product details, then publish.`
- Published products whose title, handle or tags look like a vape (vape, e-cig, e-liquid) are refused.

Owner flow: create as draft -> set attributes (widget) -> publish. CSV import (E4b): create drafts,
POST attributes, then publish (or set status in a second update).
Known gap: adding an already-published product to a guarded category from the category page
(batch link) is not checked; the next product save is.
