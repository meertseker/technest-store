# Contract: one variant's price and stock (admin)

Owner: E4 (branch `e4/admin-four-pages`). Consumer: the Products → Price & stock tab.
Status: **v1 (2026-10-03)**. Any change is posted as `[CONTRACT]`.

## `POST /admin/products/:id/variants/:variant_id/price-stock`

Admin session or bearer token. Body (`strict`, at least one of the two):

```json
{ "price_pence": 549, "stock": 7, "expected_stock": 3 }
```

- `price_pence`: the retail price including VAT, integer pence, 1 to 500 000 (£5,000, the import's
  ceiling). Written to the variant's plain GBP price: the one without a price list, without rules
  (region, customer group) and without a quantity tier. A variant without one gets one. Every other
  price (trade price-list prices, region prices, quantity tiers) is untouched. A variant with more
  than one plain GBP price is refused rather than guessed at.
- `stock`: whole number 0–100 000, the stocked quantity at the shop's location
  ("Tech Nest – Southwark Park Rd", the same location Quick add and the import use). It can't be
  lower than the quantity reserved for orders that have not been sent yet.
- `expected_stock` (optional, with `stock`): the stock the page showed when the new number was
  typed, `null` when it showed none. When it is sent and the stock has changed since (an order was
  sent, a colleague saved), nothing is written and the answer is `409`. The admin page always sends
  it; without it the number is written as given.

Response `200`, the values after the update:

```json
{ "variant_id": "variant_…", "price_pence": 549, "stock": 7 }
```

`price_pence` is `null` when the variant has no GBP price; `stock` is `null` when it has no level at
the shop.

Errors (Medusa's standard shape):

- `400 invalid_data`: a bad body (wrong type, decimals, out of range, unknown field, or neither value),
  `stock` for a variant whose stock is not tracked here ("This product's stock is not tracked here…"),
  `stock` below the reserved quantity ("2 are set aside for orders that have not been sent yet…"),
  or `price_pence` for a variant with more than one plain GBP price.
- `409 conflict`: `expected_stock` no longer matches ("The stock for this product is now 2, not 3…").
  Nothing was written, the price included. Reload the row and try again.
- `404 not_found`: the variant does not exist or is not on that product.

Stock is written first, under the inventory item's lock (the one Medusa holds while an order's
stock is taken), then the price. If the price write fails, the stock change is taken back.

Why not Medusa's `POST /admin/products/:id/variants/:vid`: in 2.21 its workflow's undo wipes every
price of the variant when a later step fails, and replacing a price set deletes the variant's other
same-currency prices. This route reuses the import's price step, which changes the one price by id
and can put it back (`src/workflows/steps/set-import-variant-prices.ts`).

Reading for the tab: `sdk.admin.product.list({ fields: "*variants,*variants.prices,*variants.inventory_items.inventory.location_levels" })`
(`inventory_quantity` is not filled in on the product list in 2.21; the levels are summed instead).
Note that Medusa stores amounts as-is in major units (5.49 = £5.49); only this route talks in pence.
