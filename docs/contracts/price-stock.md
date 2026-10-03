# Contract: one variant's price and stock (admin)

Owner: E4 (branch `e4/admin-four-pages`). Consumer: the Products → Price & stock tab.
Status: **v1 (2026-10-03)**. Any change is posted as `[CONTRACT]`.

## `POST /admin/products/:id/variants/:variant_id/price-stock`

Admin session or bearer token. Body (`strict`, at least one of the two):

```json
{ "price_pence": 549, "stock": 7 }
```

- `price_pence`: the retail price including VAT, integer pence, at least 1. Written to the variant's
  plain GBP price (the one without a price list or rules); a variant without one gets one. Other
  prices, including trade price-list prices, are untouched.
- `stock`: whole number 0–100 000, the stocked quantity at the shop's location
  ("Tech Nest – Southwark Park Rd", the same location Quick add and the import use).

Response `200`, the values after the update:

```json
{ "variant_id": "variant_…", "price_pence": 549, "stock": 7 }
```

`price_pence` is `null` when the variant has no GBP price; `stock` is `null` when it has no level at
the shop.

Errors (Medusa's standard shape):

- `400 invalid_data`: a bad body (wrong type, decimals, out of range, unknown field, or neither value),
  or `stock` for a variant whose stock is not tracked here ("This product's stock is not tracked here…").
- `404 not_found`: the variant does not exist or is not on that product.

Why not Medusa's `POST /admin/products/:id/variants/:vid`: in 2.21 its workflow's undo wipes every
price of the variant when a later step fails. This route reuses the import's price step, which
snapshots and restores prices by id instead (`src/workflows/steps/set-import-variant-prices.ts`).

Reading for the tab: `sdk.admin.product.list({ fields: "*variants,*variants.prices,*variants.inventory_items.inventory.location_levels" })`
(`inventory_quantity` is not filled in on the product list in 2.21; the levels are summed instead).
Note that Medusa stores amounts as-is in major units (5.49 = £5.49); only this route talks in pence.
