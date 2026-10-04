# Contract: delivery orders (admin)

Owner: E4 (backend + admin UI, branch `e4/admin-four-pages`). Consumer: the Orders → Delivery tab and Today.
Status: **v1 (2026-10-03)**. Any change is posted as `[CONTRACT]`.

Admin routes (admin session or bearer token; from the admin UI use `sdk.client.fetch`). Errors use
Medusa's standard shape `{ "type": "invalid_data" | "not_allowed" | "not_found" | "conflict", "message": string }`.

A **delivery order** is any order that is not Click & Collect (no shipping method on a "pickup"
fulfilment set) and not cancelled or draft. It is `to_pack` until a live fulfilment has a shipment,
`shipped` after that. Payment is normally captured when the order is placed (`order-placed-capture`),
and shipping never touches money. That capture can fail, so marking an order shipped is refused
(`not_allowed`) while its payment is only authorised, and when it was refunded in full.

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
      "shipped_at": null
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
- Whether an order has shipped is not a database filter in Medusa 2.21, so the newest
  `DELIVERY_SCAN_LIMIT` (200) orders are read and split in the app. `count` counts within that window;
  older shipped orders are under Medusa's Orders page.

## `POST /admin/delivery-orders/:id/shipped`

Body: `{}`. Fulfils every remaining item and creates the shipment, which fires `shipment.created`
(the "on its way" email, `docs/contracts/emails.md`). The admin user is recorded as `created_by`.

```json
{ "order_id": "order_…", "fulfillment_id": "ful_…", "already_shipped": false }
```

- A second call for the same order is a no-op: `200` with `already_shipped: true` and the same
  `fulfillment_id`; no second email. Two presses at once: the second waits for the first (lock
  `technest-delivery:<order id>`), then no-ops. A lock still held after 10 s gives `409 conflict`
  "… is being updated. Refresh in a moment."
- `400 not_allowed` for a Click & Collect order ("… Use the Collect tab."), a cancelled order, or an
  order with nothing left to ship. `404` for an unknown order.

Refunds are not part of this contract: they stay on Medusa's order page (owner guide 08).
