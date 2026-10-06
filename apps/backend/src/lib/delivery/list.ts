import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  DELIVERY_ORDER_FIELDS,
  DELIVERY_SCAN_FIELDS,
  type DeliveryOrder,
  type DeliveryOrderRow,
  type DeliveryStatus,
  deliveryStatusOf,
  hasDeliveryMethod,
  pickupOptionIds,
  toDeliveryOrder,
} from "."

/** Orders read per query while looking for the ones to list. */
export const DELIVERY_SCAN_PAGE = 200

/**
 * The Shipped tab shows what left recently: it looks at this many of the
 * newest orders. Older shipped orders are under Medusa's Orders page.
 */
export const DELIVERY_SHIPPED_WINDOW = 200

type ListInput = { status: DeliveryStatus; limit: number; offset: number }

/**
 * Whether an order has shipped is not something the database can filter on in
 * Medusa 2.21 (it is worked out from items and fulfilments), so orders are
 * read in pages with only the fields that decide it, and the full row is
 * loaded for the page that is returned.
 *
 * "To pack" looks at every order, however old: an order nobody packed must
 * never drop off the list because newer orders arrived. "Shipped" only looks
 * at the newest DELIVERY_SHIPPED_WINDOW orders.
 */
export async function listDeliveryOrders(
  container: MedusaContainer,
  { status, limit, offset }: ListInput,
  scanPage = DELIVERY_SCAN_PAGE
): Promise<{ orders: DeliveryOrder[]; count: number }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const pickup = await pickupOptionIds(container)
  const toPack = status === "to_pack"

  const ids: string[] = []
  for (let skip = 0; ; skip += scanPage) {
    const take = toPack ? scanPage : Math.min(scanPage, DELIVERY_SHIPPED_WINDOW - skip)
    if (take <= 0) break
    const { data } = await query.graph({
      entity: "order",
      fields: DELIVERY_SCAN_FIELDS,
      filters: { status: { $nin: ["canceled", "draft"] } },
      // To pack: oldest first, so the longest wait is packed first. Shipped: newest first.
      pagination: { take, skip, order: { created_at: toPack ? "ASC" : "DESC" } },
    })
    const rows = data as unknown as DeliveryOrderRow[]
    for (const row of rows) {
      if (hasDeliveryMethod(row, pickup) && deliveryStatusOf(row) === status) {
        ids.push(row.id)
      }
    }
    if (rows.length < take) break
  }

  const pageIds = ids.slice(offset, offset + limit)
  if (!pageIds.length) {
    return { orders: [], count: ids.length }
  }
  const { data } = await query.graph({
    entity: "order",
    fields: DELIVERY_ORDER_FIELDS,
    filters: { id: pageIds },
  })
  const byId = new Map((data as unknown as DeliveryOrderRow[]).map((o) => [o.id, o]))
  const orders = pageIds
    .map((id) => byId.get(id))
    .filter((o): o is DeliveryOrderRow => !!o)
    .map(toDeliveryOrder)
  return { orders, count: ids.length }
}
