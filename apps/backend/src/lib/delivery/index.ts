import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { toPence } from "../email/order-email-data"

/**
 * Delivery orders for the admin's Orders → Delivery tab: every order that is
 * not Click & Collect. "To pack" until a shipment exists, "shipped" after.
 * See docs/contracts/delivery-orders.md.
 */

export type DeliveryStatus = "to_pack" | "shipped"
export const DELIVERY_STATUSES = ["to_pack", "shipped"] as const

export const deliveryLockKey = (orderId: string) => `technest-delivery:${orderId}`

export const DELIVERY_ORDER_FIELDS = [
  "id",
  "display_id",
  "status",
  "created_at",
  "email",
  "total",
  "customer.first_name",
  "customer.last_name",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.postal_code",
  "shipping_address.city",
  "items.id",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.quantity",
  "items.thumbnail",
  "items.detail.fulfilled_quantity",
  "shipping_methods.shipping_option_id",
  "fulfillments.id",
  "fulfillments.shipped_at",
  "fulfillments.canceled_at",
]

export type DeliveryOrderRow = {
  id: string
  display_id?: number | null
  status: string
  created_at: string | Date
  email?: string | null
  total?: unknown
  customer?: { first_name?: string | null; last_name?: string | null } | null
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    postal_code?: string | null
    city?: string | null
  } | null
  items?: ({
    id: string
    title: string
    product_title?: string | null
    variant_title?: string | null
    quantity: unknown
    thumbnail?: string | null
    detail?: { fulfilled_quantity?: unknown } | null
  } | null)[] | null
  shipping_methods?: ({ shipping_option_id?: string | null } | null)[] | null
  fulfillments?: ({
    id: string
    shipped_at?: string | Date | null
    canceled_at?: string | Date | null
  } | null)[] | null
}

export type DeliveryOrder = {
  id: string
  display_id: number | null
  status: DeliveryStatus
  created_at: string
  email: string | null
  customer_name: string | null
  postcode: string | null
  city: string | null
  items: {
    id: string
    title: string
    variant_title: string | null
    quantity: number
    thumbnail: string | null
  }[]
  total_pence: number
  shipped_at: string | null
}

function fullName(p?: { first_name?: string | null; last_name?: string | null } | null) {
  const name = [p?.first_name, p?.last_name].map((s) => s?.trim()).filter(Boolean).join(" ")
  return name || null
}

/** The newest shipment time of a live fulfilment, or null when nothing has shipped. */
export function shippedAtOf(order: Pick<DeliveryOrderRow, "fulfillments">): string | null {
  const times = (order.fulfillments ?? [])
    .filter((f): f is NonNullable<typeof f> => !!f && !f.canceled_at && !!f.shipped_at)
    .map((f) => new Date(f.shipped_at as string | Date).getTime())
  return times.length ? new Date(Math.max(...times)).toISOString() : null
}

/** Items (and quantities) not fulfilled yet. */
export function unfulfilledItems(order: Pick<DeliveryOrderRow, "items">) {
  return (order.items ?? [])
    .filter((i): i is NonNullable<typeof i> => !!i)
    .map((i) => ({
      id: i.id,
      quantity: Number(i.quantity) - Number(i.detail?.fulfilled_quantity ?? 0),
    }))
    .filter((i) => i.quantity > 0)
}

export function toDeliveryOrder(order: DeliveryOrderRow): DeliveryOrder {
  const shipped_at = shippedAtOf(order)
  return {
    id: order.id,
    display_id: order.display_id ?? null,
    status: shipped_at ? "shipped" : "to_pack",
    created_at: new Date(order.created_at).toISOString(),
    email: order.email ?? null,
    customer_name: fullName(order.shipping_address) ?? fullName(order.customer),
    postcode: order.shipping_address?.postal_code?.trim() || null,
    city: order.shipping_address?.city?.trim() || null,
    items: (order.items ?? [])
      .filter((i): i is NonNullable<typeof i> => !!i)
      .map((i) => ({
        id: i.id,
        title: i.product_title || i.title,
        variant_title: i.variant_title ?? null,
        quantity: Number(i.quantity),
        thumbnail: i.thumbnail ?? null,
      })),
    total_pence: toPence(order.total),
    shipped_at,
  }
}

/** Ids of the shipping options that belong to a "pickup" fulfilment set (Click & Collect). */
export async function pickupOptionIds(container: MedusaContainer): Promise<Set<string>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "service_zone.fulfillment_set.type"],
  })
  return new Set(
    data.filter((o) => o.service_zone?.fulfillment_set?.type === "pickup").map((o) => o.id as string)
  )
}

export function usesPickup(order: Pick<DeliveryOrderRow, "shipping_methods">, pickup: Set<string>) {
  return (order.shipping_methods ?? []).some(
    (m) => !!m?.shipping_option_id && pickup.has(m.shipping_option_id)
  )
}

/** Loads one order for a delivery action: 404 when unknown, 400 when it is Click & Collect. */
export async function loadDeliveryOrder(
  container: MedusaContainer,
  orderId: string
): Promise<DeliveryOrderRow> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: DELIVERY_ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = data[0] as unknown as DeliveryOrderRow | undefined
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${orderId} not found`)
  }
  if (usesPickup(order, await pickupOptionIds(container))) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Order ${orderId} is a Click & Collect order. Use the Collect tab.`
    )
  }
  return order
}
