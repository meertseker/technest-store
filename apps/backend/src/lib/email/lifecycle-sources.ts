import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type {
  OrderCancelledData,
  OrderDispatchedData,
  OrderLine,
  OrderRef,
  RefundIssuedData,
  ReturnReceivedData,
} from "@technest/emails"
import { safeFirstName, storefrontUrl, toPence } from "./order-email-data"
import type { ResolvedEmail } from "./sources"

/**
 * Order metadata the day-7 Click & Collect job sets just before it cancels an
 * uncollected order (docs/contracts/click-collect.md).
 */
export const COLLECTION_EXPIRED_KEY = "collection_expired_at"

type Row = Record<string, any>

const query = (container: MedusaContainer) => container.resolve(ContainerRegistrationKeys.QUERY)

/** The order fields every lifecycle email needs, relative to `prefix`. */
const refFields = (prefix = "") =>
  ["id", "display_id", "email", "customer.first_name", "shipping_address.first_name"].map((f) => prefix + f)

function toRef(order: Row): { email: string | null; ref: OrderRef } {
  return {
    email: order.email ?? null,
    ref: {
      display_id: order.display_id ?? order.id,
      first_name: safeFirstName(order.customer?.first_name || order.shipping_address?.first_name),
      order_url: `${storefrontUrl()}/order/${order.id}/confirmed`,
    },
  }
}

const lines = (items: (Row | null)[] | null | undefined): OrderLine[] =>
  (items ?? [])
    .filter((i): i is Row => !!i)
    .map((i) => ({
      title: i.product_title || i.title,
      variant_title: i.variant_title ?? null,
      quantity: Number(i.quantity),
    }))

const done = (email: string | null, data: object): ResolvedEmail | null =>
  email ? { to: email, data: data as Record<string, unknown> } : null

/** shipment.created → resource is the fulfillment id. */
export async function orderDispatched(container: MedusaContainer, fulfillmentId: string) {
  const { data } = await query(container).graph({
    entity: "fulfillment",
    fields: [
      "id",
      "items.title",
      "items.quantity",
      "labels.tracking_number",
      "labels.tracking_url",
      ...refFields("order."),
      "order.shipping_address.last_name",
      "order.shipping_address.address_1",
      "order.shipping_address.address_2",
      "order.shipping_address.city",
      "order.shipping_address.postal_code",
    ],
    filters: { id: fulfillmentId },
  })
  const f = data[0] as Row | undefined
  if (!f?.order) return null
  const { email, ref } = toRef(f.order)
  const a = f.order.shipping_address
  const payload: OrderDispatchedData = {
    ...ref,
    items: lines(f.items),
    tracking: (f.labels ?? [])
      .filter((l: Row | null) => l?.tracking_number)
      .map((l: Row) => ({ number: l.tracking_number, url: l.tracking_url || null })),
    shipping_address: a
      ? {
          name: [a.first_name, a.last_name].filter(Boolean).join(" ") || null,
          address_1: a.address_1,
          address_2: a.address_2,
          city: a.city,
          postcode: a.postal_code,
        }
      : null,
  }
  return done(email, payload)
}

/** order.canceled → resource is the order id. */
export async function orderCancelled(container: MedusaContainer, orderId: string) {
  const { data } = await query(container).graph({
    entity: "order",
    fields: [
      ...refFields(),
      "metadata",
      "payment_collections.payments.canceled_at",
      "payment_collections.payments.refunds.amount",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as Row | undefined
  if (!order) return null
  const payments: Row[] = (order.payment_collections ?? []).flatMap((pc: Row) => pc?.payments ?? [])
  const refunded = payments
    .flatMap((p) => p?.refunds ?? [])
    .reduce((sum: number, r: Row) => sum + toPence(r?.amount), 0)
  const { email, ref } = toRef(order)
  const payload: OrderCancelledData = {
    ...ref,
    reason: order.metadata?.[COLLECTION_EXPIRED_KEY] ? "uncollected" : "other",
    payment: refunded > 0 ? "refunded" : payments.some((p) => p?.canceled_at) ? "released" : "none",
    refunded_pence: refunded,
  }
  return done(email, payload)
}

/** payment.refunded → resource is the refund id (a payment can be refunded more than once). */
export async function refundIssued(container: MedusaContainer, refundId: string) {
  const { data } = await query(container).graph({
    entity: "refund",
    fields: [
      "id",
      "amount",
      "payment.captures.amount",
      "payment.refunds.amount",
      ...refFields("payment.payment_collection.order."),
    ],
    filters: { id: refundId },
  })
  const refund = data[0] as Row | undefined
  const order = refund?.payment?.payment_collection?.order
  if (!refund || !order) return null
  const sum = (rows?: Row[]) => (rows ?? []).reduce((s, r) => s + toPence(r?.amount), 0)
  const captured = sum(refund.payment.captures)
  const { email, ref } = toRef(order)
  const payload: RefundIssuedData = {
    ...ref,
    amount_pence: toPence(refund.amount),
    full: captured > 0 && sum(refund.payment.refunds) >= captured,
  }
  return done(email, payload)
}

/** order.return_received → resource is the return id. */
export async function returnReceived(container: MedusaContainer, returnId: string) {
  const { data } = await query(container).graph({
    entity: "return",
    fields: [
      "id",
      "order_id",
      "items.quantity",
      "items.received_quantity",
      "items.item.title",
      "items.item.product_title",
      "items.item.variant_title",
    ],
    filters: { id: returnId },
  })
  const ret = data[0] as Row | undefined
  if (!ret?.order_id) return null
  const { data: orders } = await query(container).graph({
    entity: "order",
    fields: refFields(),
    filters: { id: ret.order_id },
  })
  if (!orders[0]) return null
  const { email, ref } = toRef(orders[0] as Row)
  const payload: ReturnReceivedData = {
    ...ref,
    items: lines(
      (ret.items ?? []).map((ri: Row | null) =>
        ri?.item ? { ...ri.item, quantity: Number(ri.received_quantity) || Number(ri.quantity) } : null
      )
    ),
  }
  return done(email, payload)
}
