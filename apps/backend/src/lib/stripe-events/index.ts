import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reportAlert } from "../alerting"
import { toPence } from "../email/order-email-data"
import { runEmail } from "../email/run-email"
import { recordExternalRefundWorkflow } from "../../workflows/record-external-refund"
import { REFUNDS_CHANGED } from "../../workflows/steps/payment/assert-refunds-unchanged"
import { recordPaymentNoticeWorkflow } from "../../workflows/record-payment-notice"
import { PaymentNoticeMeta } from "./constants"

export * from "./constants"

/**
 * How old a queued event's signature may be. The route already refused
 * anything older than 5 minutes when Stripe delivered it; the worker may run
 * the queued copy much later (backlog, restart), and these events are all
 * idempotent, so a replay can't do harm.
 */
export const STRIPE_EVENT_TOLERANCE_SECONDS = 24 * 60 * 60

export type StripeEvent = {
  id: string
  type: string
  livemode?: boolean
  data: { object: Record<string, any> }
}

export type StripeEventResult = { handled: string | null }

type PaymentRow = {
  id: string
  amount: unknown
  currency_code: string
  captured_at?: string | Date | null
  canceled_at?: string | Date | null
  payment_collection_id: string
  captures?: ({ amount: unknown } | null)[] | null
  refunds?: ({ id: string; amount: unknown; metadata?: Record<string, unknown> | null } | null)[] | null
  payment_collection?: {
    order?: { id: string; status: string; metadata?: Record<string, unknown> | null } | null
  } | null
}

const PAYMENT_FIELDS = [
  "id",
  "amount",
  "currency_code",
  "captured_at",
  "canceled_at",
  "payment_collection_id",
  "captures.amount",
  "refunds.id",
  "refunds.amount",
  "refunds.metadata",
  "payment_collection.order.id",
  "payment_collection.order.status",
  "payment_collection.order.metadata",
]

/** A Stripe reference: the id string, or an expanded object's id. */
const idOf = (value: unknown): string | null =>
  typeof value === "string" && value
    ? value
    : value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string"
      ? ((value as { id: string }).id)
      : null

/** Stripe codes are snake_case; anything else is not shown to people. */
const code = (value: unknown): string | null =>
  typeof value === "string" && /^[a-z0-9_]{1,40}$/.test(value) ? value : null

const sumPence = (rows?: ({ amount: unknown } | null)[] | null) =>
  (rows ?? []).reduce((sum, row) => sum + toPence(row?.amount), 0)

const smallestUnit = (value: unknown) => Math.round(Number(value) || 0)

/**
 * The Medusa payment behind a PaymentIntent. The provider stores the intent
 * as the payment's `data`, so the intent id is `data.id`.
 */
async function paymentForIntent(container: MedusaContainer, intentId: string | null): Promise<PaymentRow | null> {
  if (!intentId) return null
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "payment",
    fields: PAYMENT_FIELDS,
    // JSON filters run in Postgres (data->>'id'); the generated types don't know them.
    filters: { data: { id: intentId } } as never,
  })
  return (data[0] as unknown as PaymentRow | undefined) ?? null
}

const shopEmail = (
  container: MedusaContainer,
  template: "shop-payment-dispute" | "shop-payment-notice",
  event: StripeEvent,
  resource: { id: string; type: string },
  orderId: string
) =>
  runEmail(container, {
    template,
    recipient: "shop",
    resource_id: resource.id,
    resource_type: resource.type,
    trigger_type: event.type,
    ids: [orderId],
  })

function ignored(container: MedusaContainer, event: StripeEvent, why: string): StripeEventResult {
  // Ids only: never amounts tied to a person, never card data.
  container.resolve(ContainerRegistrationKeys.LOGGER).warn(`stripe-events: ${event.type} ${event.id} ignored: ${why}`)
  return { handled: null }
}

/**
 * charge.dispute.created / updated / closed. A new dispute is written to the
 * order, reported and emailed to the shop; a later status only updates the
 * record. An update or close for a dispute we never saw opened is treated as
 * the opening (the created event was lost).
 */
async function disputeEvent(container: MedusaContainer, event: StripeEvent): Promise<StripeEventResult> {
  const dispute = event.data.object
  const disputeId = idOf(dispute.id)
  if (!disputeId) return ignored(container, event, "no dispute id")
  const payment = await paymentForIntent(container, idOf(dispute.payment_intent))
  const order = payment?.payment_collection?.order
  if (!order) return ignored(container, event, "no order for this payment")

  const now = new Date().toISOString()
  const closed = event.type === "charge.dispute.closed"
  const current = (order.metadata ?? {})[PaymentNoticeMeta.DISPUTE] as Record<string, unknown> | undefined
  if (current?.id === disputeId) {
    if (event.type !== "charge.dispute.created") {
      await recordPaymentNoticeWorkflow(container).run({
        input: {
          order_id: order.id,
          patch: {
            [PaymentNoticeMeta.DISPUTE]: {
              ...current,
              status: code(dispute.status) ?? current.status,
              ...(closed ? { closed_at: now } : {}),
            },
          },
        },
      })
      return { handled: "dispute_updated" }
    }
    // A redelivered opening: the record exists; make sure the email went out.
    await shopEmail(container, "shop-payment-dispute", event, { id: disputeId, type: "dispute" }, order.id)
    return { handled: "dispute_known" }
  }

  const dueBy = Number(dispute.evidence_details?.due_by)
  const amountPence = smallestUnit(dispute.amount)
  const reason = code(dispute.reason) ?? "unknown"
  await recordPaymentNoticeWorkflow(container).run({
    input: {
      order_id: order.id,
      patch: {
        [PaymentNoticeMeta.DISPUTE]: {
          id: disputeId,
          status: code(dispute.status) ?? "unknown",
          reason,
          amount_pence: amountPence,
          currency: code(dispute.currency) ?? payment!.currency_code,
          due_by: Number.isFinite(dueBy) && dueBy > 0 ? new Date(dueBy * 1000).toISOString() : null,
          livemode: event.livemode === true,
          opened_at: now,
          ...(closed ? { closed_at: now } : {}),
        },
      },
    },
  })
  reportAlert(
    `Stripe dispute ${disputeId} opened on order ${order.id}: ${amountPence}p, reason ${reason}`,
    { source: "stripe-events", event: event.type, order_id: order.id, dispute_id: disputeId, reason },
    `stripe-dispute:${disputeId}`
  )
  await shopEmail(container, "shop-payment-dispute", event, { id: disputeId, type: "dispute" }, order.id)
  return { handled: "dispute_opened" }
}

/**
 * charge.refunded. Stripe sends it for every refund, ours included, with the
 * charge's cumulative `amount_refunded`. Anything above what Medusa already
 * holds as refunds was refunded outside the admin (the Stripe dashboard): it
 * is written to the payment and the order like an admin refund would be (so
 * the admin can't refund it again, the order shows it, and the customer gets
 * the usual refund email), the shop is told, and a person is alerted. When
 * Medusa never captured enough to cover it, only a note is written.
 */
async function chargeRefundedOnce(container: MedusaContainer, event: StripeEvent): Promise<StripeEventResult> {
  const charge = event.data.object
  const payment = await paymentForIntent(container, idOf(charge.payment_intent))
  const order = payment?.payment_collection?.order
  if (!payment || !order) return ignored(container, event, "no order for this payment")

  const stripePence = smallestUnit(charge.amount_refunded)
  const knownPence = sumPence(payment.refunds)
  const deltaPence = stripePence - knownPence
  if (deltaPence <= 0) return { handled: "refund_known" }

  const recordable = deltaPence <= sumPence(payment.captures) - knownPence
  const listed = ((charge.refunds?.data ?? []) as { id?: unknown; amount?: unknown }[]).filter(
    (r) => smallestUnit(r.amount) === deltaPence && idOf(r.id)
  )
  const refundId = listed.length === 1 ? idOf(listed[0].id)! : `${idOf(charge.id) ?? "charge"}:${stripePence}`
  const existing = ((order.metadata ?? {})[PaymentNoticeMeta.EXTERNAL_REFUNDS] as { id?: unknown }[] | undefined) ?? []
  const resource = { id: refundId, type: "refund" }
  if (existing.some((r) => r?.id === refundId)) {
    await shopEmail(container, "shop-payment-notice", event, resource, order.id)
    return { handled: "external_refund_known" }
  }

  const at = new Date().toISOString()
  const entry = { id: refundId, amount_pence: deltaPence, at, ...(recordable ? {} : { unrecorded: true }) }
  const patch = { [PaymentNoticeMeta.EXTERNAL_REFUNDS]: [...existing, entry] }
  if (recordable) {
    await recordExternalRefundWorkflow(container).run({
      input: {
        order_id: order.id,
        payment_id: payment.id,
        payment_collection_id: payment.payment_collection_id,
        // Medusa amounts are major units.
        amount: Number((deltaPence / 100).toFixed(2)),
        currency_code: payment.currency_code,
        known_pence: knownPence,
        stripe_refund_id: refundId,
        metadata_patch: patch,
      },
    })
  } else {
    await recordPaymentNoticeWorkflow(container).run({ input: { order_id: order.id, patch } })
  }
  reportAlert(
    `Refund of ${deltaPence}p made at Stripe outside the admin on order ${order.id}` +
      (recordable ? "" : " (more than Medusa captured: noted on the order, not written as a refund)"),
    { source: "stripe-events", event: event.type, order_id: order.id, refund_id: refundId, recorded: recordable },
    `stripe-external-refund:${refundId}`
  )
  await shopEmail(container, "shop-payment-notice", event, resource, order.id)
  return { handled: recordable ? "external_refund_recorded" : "external_refund_noted" }
}

const isRefundsChanged = (e: unknown) =>
  typeof (e as { message?: unknown } | null)?.message === "string" &&
  (e as { message: string }).message.includes(REFUNDS_CHANGED)

/**
 * The refunds are read before the order's lock is taken; if they changed by
 * the time it is held (the same event delivered twice at once, or an admin
 * refund in between), nothing was written and the decision is made again.
 */
async function chargeRefunded(container: MedusaContainer, event: StripeEvent): Promise<StripeEventResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await chargeRefundedOnce(container, event)
    } catch (e) {
      if (!isRefundsChanged(e) || attempt >= 3) throw e
    }
  }
}

/**
 * payment_intent.canceled. Our own cancels (hold release, order cancel) mark
 * the Medusa payment cancelled first, so a cancelled intent on an uncancelled
 * payment of a live order was cancelled at Stripe: expired, or cancelled in
 * the dashboard. The order can't be captured any more; staff must know.
 */
async function intentCanceled(container: MedusaContainer, event: StripeEvent): Promise<StripeEventResult> {
  const intent = event.data.object
  const intentId = idOf(intent.id)
  const payment = await paymentForIntent(container, intentId)
  if (!payment) return ignored(container, event, "no payment for this intent")
  if (payment.canceled_at) return { handled: "cancelled_by_us" }
  const order = payment.payment_collection?.order
  if (!order || order.status === "canceled") return { handled: "order_cancelled" }

  const current = (order.metadata ?? {})[PaymentNoticeMeta.HOLD_RELEASED] as { payment_intent?: unknown } | undefined
  const resource = { id: intentId!, type: "payment_intent" }
  if (current?.payment_intent !== intentId) {
    const reason = code(intent.cancellation_reason)
    await recordPaymentNoticeWorkflow(container).run({
      input: {
        order_id: order.id,
        patch: {
          [PaymentNoticeMeta.HOLD_RELEASED]: {
            payment_intent: intentId,
            reason,
            amount_pence: smallestUnit(intent.amount),
            at: new Date().toISOString(),
          },
        },
      },
    })
    reportAlert(
      `The card hold of order ${order.id} was released at Stripe (reason: ${reason ?? "none given"}); the payment can't be captured`,
      { source: "stripe-events", event: event.type, order_id: order.id, reason: reason ?? undefined },
      `stripe-hold-released:${intentId}`
    )
  }
  await shopEmail(container, "shop-payment-notice", event, resource, order.id)
  return { handled: "hold_released" }
}

/** Dispatches one verified Stripe event. Events Medusa handles itself, and unknown types, are left alone. */
export async function handleStripeEvent(container: MedusaContainer, event: StripeEvent): Promise<StripeEventResult> {
  switch (event.type) {
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed":
      return disputeEvent(container, event)
    case "charge.refunded":
      return chargeRefunded(container, event)
    case "payment_intent.canceled":
      return intentCanceled(container, event)
    default:
      return { handled: null }
  }
}
