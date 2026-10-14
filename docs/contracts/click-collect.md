# Contract: Click & Collect board and payment capture

Owner: E2. Consumers: E4 (Click & Collect board in the admin), E2 email subscribers (events below).
Status: **v1 (2026-09-30)**. Build against this. Any change is posted as `[CONTRACT]`.

All routes need an admin session or token (use the admin SDK: `sdk.client.fetch`).
Errors use Medusa's standard shape: `{ "type": "not_found" | "not_allowed" | "invalid_data" | ..., "message": string }`.

## Rules

- Stripe (`pp_stripe_stripe`) runs with `capture: false`: checkout only authorises.
- **Delivery orders** are captured by the backend right after `order.placed`. Staff do nothing.
  If that capture fails or the event never arrives, the `capture-retry` job (every 10 minutes) tries again:
  first when the order is 15 minutes old, then after 15 min, 30 min, 1 h, 2 h and 4 h. After the 6th failed
  attempt it gives up and emits `technest.payment.capture_failed` `{ order_id }` once. Until the payment is
  taken the order can't be marked shipped. The job's state is in order metadata
  (`capture_retry_attempts`, `capture_retry_last_at`, `capture_retry_gave_up_at`).
  Duplicate `order.placed` deliveries never capture twice (per-order lock + "already captured" check).
- **Click & Collect orders** (shipping option in the `pickup` fulfillment set) are captured when
  staff press **Collected**. They are never captured at `order.placed`.
- Uncollected Click & Collect orders: a reminder 3 days after "ready", and at the **collection
  deadline** the order
  is cancelled and the card authorisation is released (Medusa's `cancelOrderWorkflow`, which
  cancels uncaptured payments; `order.canceled` is emitted by core). Core only logs a failed
  payment cancel, so the backend retries it once and logs the order/payment ids if it still fails.
  An uncollected order whose payment is already captured (a Collected press that failed after the
  capture) is never cancelled automatically, because that would refund it: it is logged for staff.
- Handed over with Medusa's own order page instead of the board (a pickup order's fulfilment
  marked delivered or shipped there): the hourly `click-collect-lifecycle` job captures the payment
  (same capture step, under the order's lock, never twice), sets `collected_at` and
  `collected_outside_board = { fulfillment_id, at }`, emits `technest.order.collected`, raises one
  Sentry alert and sends the shop one `shop-payment-notice` email so staff learn to use the board.
  A fulfilment that is only created (not delivered/shipped) is left alone. If no payment is left to
  capture, nothing is marked collected and the job reports the order every hour until staff act.
- The signed Stripe webhook authorises; "Collected" captures, and the capture is recorded from
  Stripe's response to the capture call. Nothing on the board is refunded automatically.

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
| `technest.payment.capture_failed` | `{ order_id }` | the `capture-retry` job (delivery orders) and the capture step in `mark-collected` | delivery: once, when the job gives up after its last attempt; Click & Collect: each time a capture is refused at the counter |
| `technest.order.ready_for_collection` | `{ order_id }` | `mark-ready-for-collection` workflow | first time an order is marked ready |
| `technest.order.collected` | `{ order_id }` | `mark-collected` workflow; `collect-outside-board` (lifecycle job) | order collected (on the board, or found handed over from the order page) |
| `technest.order.collection_reminder` | `{ order_id }` | hourly job `click-collect-lifecycle` | once, 3 days after ready |
| `order.canceled` (core) | `{ id }` | `cancelOrderWorkflow`, run by the hourly job | at the collection deadline, uncollected (ready or never marked ready) |

## Order metadata (written by the backend only; read-only for everyone else)

| Key | Value |
|---|---|
| `collection_code` | `"K7MQ2X"` |
| `ready_for_collection_at` | ISO 8601 |
| `collected_at` | ISO 8601 |
| `collection_reminder_sent_at` | ISO 8601 |
| `collection_expired_at` | ISO 8601, set when the job cancels a ready order at its deadline (not set for an order never marked ready) |
| `collected_outside_board` | `{ fulfillment_id, at }`: handed over from Medusa's order page; payment taken by the lifecycle job |

## Refunds

Refunds use Medusa's stock admin order page (`POST /admin/payments/:id/refund`), which calls the
Stripe provider's `refundPayment` for captured payments, partial or full. Core emits
`payment.refunded` `{ id }` (payment id). Nothing custom is needed on the board.

## Collection deadline

One value, `collectionDeadline` in `apps/backend/src/lib/click-collect/deadline.ts`, decides when an
uncollected order is cancelled and which date the emails promise (`hold_until`). It is the earlier of:

- 7 days after the order was marked ready, end of that London day;
- the end of the last whole London day on which the card authorisation can still be captured
  (the authorisation lasts 7 days from the order; a few hours are kept spare).

It is always the end of a London day. Because the card is authorised when the order is placed, the
second limit is the one that applies in practice: an order placed on a Monday is kept until the end
of Sunday, whenever it was marked ready. An order never marked ready is cancelled at the same
deadline, so its stock is released and no authorisation is left to lapse.
