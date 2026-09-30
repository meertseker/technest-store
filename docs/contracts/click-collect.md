# Contract: Click & Collect board and payment capture

Owner: E2. Consumers: E4 (Click & Collect board in the admin), E2 email subscribers (events below).
Status: **v1 (2026-09-30)**. Build against this. Any change is posted as `[CONTRACT]`.

All routes need an admin session or token (use the admin SDK: `sdk.client.fetch`).
Errors use Medusa's standard shape: `{ "type": "not_found" | "not_allowed" | "invalid_data" | ..., "message": string }`.

## Rules

- Stripe (`pp_stripe_stripe`) runs with `capture: false`: checkout only authorises.
- **Delivery orders** are captured by the backend right after `order.placed`. Staff do nothing.
  If capture fails, the backend emits `technest.payment.capture_failed` `{ order_id }`.
  Duplicate `order.placed` deliveries never capture twice (per-order lock + "already captured" check).
- **Click & Collect orders** (shipping option in the `pickup` fulfillment set) are captured when
  staff press **Collected**. They are never captured at `order.placed`.
- Uncollected Click & Collect orders: a reminder 3 days after "ready", and after 7 days the order
  is cancelled and the card authorisation is released (Medusa's `cancelOrderWorkflow`, which
  cancels uncaptured payments; `order.canceled` is emitted by core). Core only logs a failed
  payment cancel, so the backend retries it once and logs the order/payment ids if it still fails.
  An uncollected order whose payment is already captured (a Collected press that failed after the
  capture) is never cancelled automatically, because that would refund it: it is logged for staff.
- Only the signed Stripe webhook marks an order paid; capturing an authorisation here does not
  replace it. Nothing on the board is refunded automatically.

## Board columns

| `status` | Meaning |
|---|---|
| `to_pick` | Click & Collect order, not cancelled, not yet marked ready |
| `ready` | Marked ready, not yet collected, not cancelled |
| `collected` | Collected (payment captured, items fulfilled and delivered) |

Cancelled orders never appear on the board.

## Types

```ts
type CollectStatus = "to_pick" | "ready" | "collected"

type ClickCollectOrder = {
  id: string                    // "order_01J..."
  display_id: number            // 1042 -> show as "#1042"
  status: CollectStatus
  collection_code: string | null // "K7MQ2X": 6 chars from A-Z/2-9 without 0 O 1 I L; set when marked ready
  customer_name: string | null  // "Sam Smith" (customer, else shipping/billing address name)
  items_summary: string         // "2 x USB-C cable (1 m), 1 x iPhone 16 case"
  item_count: number            // total quantity
  items: { title: string; variant_title: string | null; quantity: number }[]
  total_pence: number           // order total, integer pence, VAT inclusive
  created_at: string            // ISO 8601
  ready_at: string | null       // ISO 8601, when marked ready
  collected_at: string | null   // ISO 8601
  reminder_sent_at: string | null // ISO 8601, when the day-3 reminder event was emitted
}
```

## Routes

### `GET /admin/click-collect/orders`

Query: `status` (required, `CollectStatus`), `limit?` (1-100, default 50), `offset?` (default 0).

Sort: `to_pick` and `ready` oldest first (by `created_at`), `collected` newest first (by `created_at`).

Response `200`:

```json
{
  "orders": [
    {
      "id": "order_01J9ZQ...",
      "display_id": 1042,
      "status": "ready",
      "collection_code": "K7MQ2X",
      "customer_name": "Sam Smith",
      "items_summary": "2 x USB-C cable (1 m)",
      "item_count": 2,
      "items": [{ "title": "USB-C cable", "variant_title": "1 m", "quantity": 2 }],
      "total_pence": 998,
      "created_at": "2026-09-30T09:12:00.000Z",
      "ready_at": "2026-09-30T11:40:00.000Z",
      "collected_at": null,
      "reminder_sent_at": null
    }
  ],
  "count": 1,
  "limit": 50,
  "offset": 0
}
```

`400 invalid_data` when `status` is missing or unknown.

### `POST /admin/click-collect/orders/:id/ready`

No body. Marks a `to_pick` order ready, creates the collection code (kept if it already exists)
and emits `technest.order.ready_for_collection` `{ order_id }`.

Response `200`: `{ "order": ClickCollectOrder }`.

- Pressing it again on a `ready` order is a no-op: `200`, same code, **no second event**.
- `404 not_found`: unknown order.
- `400 not_allowed`: not a Click & Collect order, cancelled, or already collected.
- `409 conflict`: another press on the same order is still running. Medusa replaces the message with its generic conflict text: refresh the board and retry.

### `POST /admin/click-collect/orders/:id/collected`

No body. For a `ready` order: captures the authorised payment, fulfils all items from the
Tech Nest location and marks the fulfilment delivered, then emits `technest.order.collected` `{ order_id }`.

Response `200`: `{ "order": ClickCollectOrder }`.

- Pressing it again on a `collected` order is a no-op: `200`, **no second capture, no second event**.
- `404 not_found`: unknown order.
- `400 not_allowed`: not a Click & Collect order, cancelled, not marked ready yet, or there is no
  authorised payment to capture (e.g. the authorisation was cancelled).
- `422 payment_authorization_error`, message starting `Payment could not be captured`: the
  provider refused the capture. Nothing was taken; `technest.payment.capture_failed` is emitted;
  the order stays `ready` and Collected can be pressed again.
- `409 conflict`: another press on the same order is still running. Medusa replaces the message with its generic conflict text: refresh the board and retry.
- `500` with a message starting `Payment captured but` when the payment was captured and a later
  step (fulfilment, delivery) failed. **Nothing is refunded automatically.** Pressing Collected again
  retries the remaining steps without capturing twice. Show the message to staff as-is.

## Events (emitted with these exact payloads)

| Event | Payload | Emitted by | When |
|---|---|---|---|
| `technest.payment.capture_failed` | `{ order_id }` | capture step (`capture-delivery-order` via the `order.placed` subscriber, and `mark-collected`) | a capture was refused or the delivery capture failed; once per failed attempt |
| `technest.order.ready_for_collection` | `{ order_id }` | `mark-ready-for-collection` workflow | first time an order is marked ready |
| `technest.order.collected` | `{ order_id }` | `mark-collected` workflow | order collected |
| `technest.order.collection_reminder` | `{ order_id }` | hourly job `click-collect-lifecycle` | once, 3 days after ready |
| `order.canceled` (core) | `{ id }` | `cancelOrderWorkflow`, run by the hourly job | 7 days after ready, uncollected |

## Order metadata (written by the backend only; read-only for everyone else)

| Key | Value |
|---|---|
| `collection_code` | `"K7MQ2X"` |
| `ready_for_collection_at` | ISO 8601 |
| `collected_at` | ISO 8601 |
| `collection_reminder_sent_at` | ISO 8601 |
| `collection_expired_at` | ISO 8601, set when the day-7 job cancels the order |

## Refunds

Refunds use Medusa's stock admin order page (`POST /admin/payments/:id/refund`), which calls the
Stripe provider's `refundPayment` for captured payments, partial or full. Core emits
`payment.refunded` `{ id }` (payment id). Nothing custom is needed on the board.
