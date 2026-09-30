import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  COLLECT_ORDER_FIELDS,
  collectStatusOf,
  type ClickCollectOrder,
  type CollectOrderRow,
  type CollectStatus,
  pickupShippingOptionIds,
  toClickCollectOrder,
} from "."

export type ListClickCollectOrdersInput = {
  status: CollectStatus
  limit: number
  offset: number
}

/**
 * Click & Collect orders (not cancelled) in one board column.
 * `to_pick`/`ready`: oldest first; `collected`: newest first.
 */
export async function listClickCollectOrders(
  container: MedusaContainer,
  { status, limit, offset }: ListClickCollectOrdersInput
): Promise<{ orders: ClickCollectOrder[]; count: number }> {
  const optionIds = await pickupShippingOptionIds(container)
  if (!optionIds.length) return { orders: [], count: 0 }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: COLLECT_ORDER_FIELDS,
    filters: {
      status: { $nin: ["canceled", "draft"] },
      shipping_methods: { shipping_option_id: optionIds },
    },
    pagination: { order: { created_at: status === "collected" ? "DESC" : "ASC" } },
  })

  const matching = (data as unknown as CollectOrderRow[]).filter(
    (o) => collectStatusOf(o.metadata) === status
  )
  return {
    orders: matching.slice(offset, offset + limit).map(toClickCollectOrder),
    count: matching.length,
  }
}
