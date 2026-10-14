import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ShopPaymentDisputeData, ShopPaymentNoticeData } from "@technest/emails"
import { PaymentNoticeMeta } from "../stripe-events/constants"
import { shopNotifyEmail, toPence } from "./order-email-data"
import type { EmailRecipient, ResolvedEmail } from "./sources"
import { adminBase } from "./trade-sources"

type Row = Record<string, any>

async function loadOrder(container: MedusaContainer, orderId: string): Promise<Row | undefined> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id", "total", "metadata"],
    filters: { id: orderId },
  })
  return data[0] as Row | undefined
}

/** Stripe codes are snake_case; anything else is not shown to staff. */
const code = (value: unknown): string | null =>
  typeof value === "string" && /^[a-z0-9_]{1,40}$/.test(value) ? value : null

/** "Friday 24 October" in shop time, or null when the value isn't a date. */
export function shopDay(iso: unknown): string | null {
  const time = typeof iso === "string" ? Date.parse(iso) : NaN
  if (!Number.isFinite(time)) return null
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  }).format(new Date(time))
}

const stripeDashboard = (livemode: unknown) => `https://dashboard.stripe.com${livemode === true ? "" : "/test"}`

const done = (data: object): ResolvedEmail => ({ to: shopNotifyEmail(), data: data as Record<string, unknown> })

/**
 * shop-payment-dispute: resource is the Stripe dispute id, `ids[0]` the order.
 * The data comes from the dispute note the stripe-events handler wrote on the
 * order, so a retry shows the current status.
 */
export async function paymentDispute(
  container: MedusaContainer,
  disputeId: string,
  recipient: EmailRecipient,
  ids: string[] = []
): Promise<ResolvedEmail | null> {
  if (recipient !== "shop" || !ids[0]) return null
  const order = await loadOrder(container, ids[0])
  const dispute = order?.metadata?.[PaymentNoticeMeta.DISPUTE] as Row | undefined
  if (!order || !dispute || dispute.id !== disputeId) return null
  const data: ShopPaymentDisputeData = {
    display_id: order.display_id ?? order.id,
    amount_pence: Math.round(Number(dispute.amount_pence) || 0),
    reason: code(dispute.reason) ?? "unknown",
    status: code(dispute.status) ?? "unknown",
    due_by: shopDay(dispute.due_by),
    dispute_url: `${stripeDashboard(dispute.livemode)}/disputes/${encodeURIComponent(disputeId)}`,
    admin_order_url: `${adminBase()}/orders/${order.id}`,
  }
  return done(data)
}

/**
 * shop-payment-notice: resource is the Stripe refund id, PaymentIntent id or
 * fulfilment id the note on the order was written for; `ids[0]` the order.
 */
export async function paymentNotice(
  container: MedusaContainer,
  resourceId: string,
  recipient: EmailRecipient,
  ids: string[] = []
): Promise<ResolvedEmail | null> {
  if (recipient !== "shop" || !ids[0]) return null
  const order = await loadOrder(container, ids[0])
  if (!order) return null
  const meta = (order.metadata ?? {}) as Row
  const base = {
    display_id: order.display_id ?? order.id,
    admin_order_url: `${adminBase()}/orders/${order.id}`,
  }

  const refund = ((meta[PaymentNoticeMeta.EXTERNAL_REFUNDS] as Row[] | undefined) ?? []).find(
    (r) => r?.id === resourceId
  )
  if (refund) {
    const data: ShopPaymentNoticeData = {
      ...base,
      kind: "external_refund",
      amount_pence: Math.round(Number(refund.amount_pence) || 0),
      unrecorded: refund.unrecorded === true,
    }
    return done(data)
  }

  const hold = meta[PaymentNoticeMeta.HOLD_RELEASED] as Row | undefined
  if (hold?.payment_intent === resourceId) {
    const data: ShopPaymentNoticeData = {
      ...base,
      kind: "hold_released",
      amount_pence: Math.round(Number(hold.amount_pence) || 0),
      reason: code(hold.reason),
    }
    return done(data)
  }

  const collected = meta[PaymentNoticeMeta.COLLECTED_OUTSIDE_BOARD] as Row | undefined
  if (collected?.fulfillment_id === resourceId) {
    const data: ShopPaymentNoticeData = {
      ...base,
      kind: "collected_outside_board",
      amount_pence: toPence(order.total),
    }
    return done(data)
  }
  return null
}
