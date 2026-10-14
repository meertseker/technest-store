/**
 * Order metadata keys written from Stripe events and by the pickup sweep
 * (docs/contracts/payments.md section 3, docs/contracts/click-collect.md).
 * Only the backend writes them; a shopper's cart metadata can't carry them.
 */
export const PaymentNoticeMeta = {
  /** `{ id, status, reason, amount_pence, currency, due_by, livemode, opened_at, closed_at? }` */
  DISPUTE: "dispute",
  /** `[{ id, amount_pence, at, unrecorded? }]`: refunds made in the Stripe dashboard. */
  EXTERNAL_REFUNDS: "external_refunds",
  /** `{ payment_intent, reason, amount_pence, at }`: the authorisation was cancelled at Stripe, not by us. */
  HOLD_RELEASED: "payment_hold_released",
  /** `{ fulfillment_id, at }`: a pickup order delivered from Medusa's order page, captured by the sweep. */
  COLLECTED_OUTSIDE_BOARD: "collected_outside_board",
} as const
