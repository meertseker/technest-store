import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  DELIVERY_ORDER_FIELDS,
  type DeliveryOrder,
  type DeliveryOrderRow,
  type DeliveryStatus,
  pickupOptionIds,
  toDeliveryOrder,
  usesPickup,
} from "."

/**
 * How many recent orders are read before splitting them into "to pack" and
 * "shipped". Whether an order has shipped is not a database filter in 2.21
 * (fulfillment_status is computed), so the newest orders are read and split
 * here. A small shop never has more open delivery orders than this, and the
 * Shipped column only needs the recent ones; older ones are under Orders.
 */
export const DELIVERY_SCAN_LIMIT = 200

export async function listDeliveryOrders(
  container: MedusaContainer,
  { status, limit, offset }: { status: DeliveryStatus; limit: number; offset: number }
): Promise<{ orders: DeliveryOrder[]; count: number }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const pickup = await pickupOptionIds(container)
  const { data } = await query.graph({
    entity: "order",
    fields: DELIVERY_ORDER_FIELDS,
    filters: { status: { $nin: ["canceled", "draft"] } },
    pagination: { take: DELIVERY_SCAN_LIMIT, skip: 0, order: { created_at: "DESC" } },
  })
  const rows = (data as unknown as DeliveryOrderRow[])
    .filter((o) => !usesPickup(o, pickup))
    .map(toDeliveryOrder)
    .filter((o) => o.status === status)
  // To pack: oldest first, so the longest wait is packed first. Shipped: newest first.
  if (status === "to_pack") rows.reverse()
  return { orders: rows.slice(offset, offset + limit), count: rows.length }
}
