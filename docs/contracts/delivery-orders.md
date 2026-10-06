# Contract: delivery orders (admin)

Owner: E4 (backend + admin UI, branch `e4/admin-four-pages`). Consumer: the Orders → Delivery tab and Today.
Status: **v1 (2026-10-03)**. Any change is posted as `[CONTRACT]`.

Admin routes (admin session or bearer token; from the admin UI use `sdk.client.fetch`). Errors use
Medusa's standard shape `{ "type": "invalid_data" | "not_allowed" | "not_found" | "conflict", "message": string }`.

A **delivery order** is an order with a shipping method, none of them Click & Collect (a "pickup"
fulfilment set), that is not cancelled or draft. An order with no shipping method at all is not a
delivery order: it is not listed here and cannot be marked shipped here. An order is `shipped` once
every item is fulfilled and every live fulfilment has a shipment; until then it is `to_pack`, also
when part of it has already left (`partly_shipped`) or when it was fulfilled on Medusa's order page
but never marked shipped. Payment is normally captured when the order is placed
(`order-placed-capture`), and shipping never touches money. That capture can fail, so marking an
order shipped is refused (`not_allowed`) while its payment is only authorised, and when it was
refunded in full; each row says which (`payment_status`).

## `GET /admin/delivery-orders?status=to_pack|shipped&limit=20&offset=0`

`status` is required. `limit` 1–50 (default 20), `offset` ≥ 0.

```json
{
  "orders": [
    {
      "id": "order_…",
      "display_id": 42,
      "status": "to_pack",
      "created_at": "2026-10-03T09:12:00.000Z",
      "email": "sam@example.com",
      "customer_name": "Sam Smith",
      "postcode": "SE16 1AA",
      "city": "London",
      "items": [{ "id": "ordli_…", "title": "USB-C cable", "variant_title": "1 m", "quantity": 2, "thumbnail": null }],
      "total_pence": 1347,
      "shipped_at": null,
      "partly_shipped": false,
      "payment_status": "paid"
    }
  ],
  "count": 1,
  "limit": 20,
  "offset": 0
}
```

- `to_pack` is oldest first (pack the longest wait first); `shipped` is newest first.
- `customer_name` is the delivery address name, else the customer's. `total_pence` is the order
  total including VAT and delivery, in integer pence.
- `shipped_at` is when the last parcel left, and `null` until the whole order has shipped.
  `payment_status` is `paid`, `not_taken` (authorised only, or no payment) or `refunded` (in full).
- Whether an order has shipped is not a database filter in Medusa 2.21, so orders are read in pages
  and split in the app. `to_pack` looks at every order however old, so an unpacked order never drops
  off the list; `shipped` looks at the newest `DELIVERY_SHIPPED_WINDOW` (200) orders, and older
  shipped orders are under Medusa's Orders page. `count` is the number of matching orders found.

## `POST /admin/delivery-orders/:id/shipped`

Body: `{}`. Creates the shipment for every fulfilment that was packed but never marked shipped, then
fulfils every remaining item and ships that too. Each shipment fires `shipment.created` (the "on its
way" email, `docs/contracts/emails.md`). The admin user is recorded as `created_by`.
`fulfillment_id` is the fulfilment shipped last.

```json
{ "order_id": "order_…", "fulfillment_id": "ful_…", "already_shipped": false }
```

- A second call for the same order is a no-op: `200` with `already_shipped: true` and the same
  `fulfillment_id`; no second email. Two presses at once: the second waits for the first, then
  no-ops. The lock is the order's own (`technest-click-collect:<order id>`), the one taking its
  payment holds, so an order is never shipped while its payment is being captured. A lock still held
  after 10 s gives `409 conflict` "… is being updated. Refresh in a moment."
- `400 not_allowed` for a Click & Collect order ("… Use the Collect tab."), an order with no delivery
  method, a cancelled or draft order, an order whose payment was not taken or was refunded in full,
  or an order with nothing left to ship. `404` for an unknown order.

Refunds are not part of this contract: they stay on Medusa's order page (owner guide 08).
