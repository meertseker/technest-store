import { randomInt } from "crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { isPickupOrder, toPence } from "../email/order-email-data"

/** Custom events (payloads are `{ order_id }`). See docs/contracts/click-collect.md. */
export const ClickCollectEvents = {
  READY_FOR_COLLECTION: "technest.order.ready_for_collection",
  COLLECTED: "technest.order.collected",
  COLLECTION_REMINDER: "technest.order.collection_reminder",
  CAPTURE_FAILED: "technest.payment.capture_failed",
} as const

/** Order metadata keys written by the backend. */
export const CollectMeta = {
  CODE: "collection_code",
  READY_AT: "ready_for_collection_at",
  COLLECTED_AT: "collected_at",
  REMINDER_SENT_AT: "collection_reminder_sent_at",
  EXPIRED_AT: "collection_expired_at",
} as const

export const REMINDER_AFTER_MS = 3 * 24 * 60 * 60 * 1000
export const EXPIRE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

/** Lock key shared by every Click & Collect mutation of one order. */
export const collectLockKey = (orderId: string) => `technest-click-collect:${orderId}`

// Uppercase letters and digits without the look-alikes 0 O 1 I L.
export const COLLECTION_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
export const COLLECTION_CODE_LENGTH = 6

export function generateCollectionCode(): string {
  let code = ""
  for (let i = 0; i < COLLECTION_CODE_LENGTH; i++) {
    code += COLLECTION_CODE_ALPHABET[randomInt(COLLECTION_CODE_ALPHABET.length)]
  }
  return code
}

export type CollectStatus = "to_pick" | "ready" | "collected"
export const COLLECT_STATUSES = ["to_pick", "ready", "collected"] as const

type Meta = Record<string, unknown> | null | undefined

const str = (v: unknown) => (typeof v === "string" && v ? v : null)

export function collectStatusOf(metadata: Meta): CollectStatus {
  if (str(metadata?.[CollectMeta.COLLECTED_AT])) return "collected"
  if (str(metadata?.[CollectMeta.READY_AT])) return "ready"
  return "to_pick"
}

/** Fields needed to validate and act on a Click & Collect order. */
export const COLLECT_ORDER_FIELDS = [
  "id",
  "display_id",
  "status",
  "metadata",
  "created_at",
  "total",
  "customer.first_name",
  "customer.last_name",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "billing_address.first_name",
  "billing_address.last_name",
  "items.id",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.quantity",
  "items.detail.fulfilled_quantity",
  "shipping_methods.shipping_option_id",
  "payment_collections.id",
  "payment_collections.status",
  "payment_collections.payments.id",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
]

export type CollectOrderPayment = {
  id: string
  captured_at?: string | Date | null
  canceled_at?: string | Date | null
}

export type CollectOrderRow = {
  id: string
  display_id?: number | null
  status: string
  metadata?: Record<string, unknown> | null
  created_at: string | Date
  total?: unknown
  customer?: { first_name?: string | null; last_name?: string | null } | null
  shipping_address?: { first_name?: string | null; last_name?: string | null } | null
  billing_address?: { first_name?: string | null; last_name?: string | null } | null
  items?: ({
    id: string
    title: string
    product_title?: string | null
    variant_title?: string | null
    quantity: unknown
    detail?: { fulfilled_quantity?: unknown } | null
  } | null)[] | null
  shipping_methods?: ({ shipping_option_id?: string | null } | null)[] | null
  payment_collections?: ({
    id: string
    status?: string
    payments?: (CollectOrderPayment | null)[] | null
  } | null)[] | null
}

export function paymentsOf(order: CollectOrderRow): CollectOrderPayment[] {
  return (order.payment_collections ?? [])
    .flatMap((pc) => pc?.payments ?? [])
    .filter((p): p is CollectOrderPayment => !!p)
}

/** Loads an order for a Click & Collect action; 404 when unknown, 400 when not a pickup order. */
export async function loadPickupOrder(
  container: MedusaContainer,
  orderId: string
): Promise<CollectOrderRow> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: COLLECT_ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = data[0] as unknown as CollectOrderRow | undefined
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${orderId} not found`)
  }
  const pickup = await isPickupOrder(
    container,
    (order.shipping_methods ?? []).map((m) => m?.shipping_option_id)
  )
  if (!pickup) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Order ${orderId} is not a Click & Collect order`
    )
  }
  return order
}

export type ClickCollectOrder = {
  id: string
  display_id: number | null
  status: CollectStatus
  collection_code: string | null
  customer_name: string | null
  items_summary: string
  item_count: number
  items: { title: string; variant_title: string | null; quantity: number }[]
  total_pence: number
  created_at: string
  ready_at: string | null
  collected_at: string | null
  reminder_sent_at: string | null
}

function fullName(p?: { first_name?: string | null; last_name?: string | null } | null) {
  const name = [p?.first_name, p?.last_name].map((s) => s?.trim()).filter(Boolean).join(" ")
  return name || null
}

/** The card shape of docs/contracts/click-collect.md. */
export function toClickCollectOrder(order: CollectOrderRow): ClickCollectOrder {
  const meta = order.metadata ?? {}
  const items = (order.items ?? [])
    .filter((i): i is NonNullable<typeof i> => !!i)
    .map((i) => ({
      title: i.product_title || i.title,
      variant_title: i.variant_title ?? null,
      quantity: Number(i.quantity),
    }))
  return {
    id: order.id,
    display_id: order.display_id ?? null,
    status: collectStatusOf(meta),
    collection_code: str(meta[CollectMeta.CODE]),
    customer_name:
      fullName(order.customer) ?? fullName(order.shipping_address) ?? fullName(order.billing_address),
    items_summary: items
      .map((i) => `${i.quantity} x ${i.title}${i.variant_title ? ` (${i.variant_title})` : ""}`)
      .join(", "),
    item_count: items.reduce((sum, i) => sum + i.quantity, 0),
    items,
    total_pence: toPence(order.total),
    created_at: new Date(order.created_at).toISOString(),
    ready_at: str(meta[CollectMeta.READY_AT]),
    collected_at: str(meta[CollectMeta.COLLECTED_AT]),
    reminder_sent_at: str(meta[CollectMeta.REMINDER_SENT_AT]),
  }
}

/** Ids of the shipping options in the "pickup" fulfillment set(s). */
export async function pickupShippingOptionIds(container: MedusaContainer): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "service_zone.fulfillment_set.type"],
  })
  return data
    .filter((o) => o.service_zone?.fulfillment_set?.type === "pickup")
    .map((o) => o.id)
}
