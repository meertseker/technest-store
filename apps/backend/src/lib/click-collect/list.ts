import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  COLLECT_ORDER_FIELDS,
  CollectMeta,
  type ClickCollectOrder,
  type CollectOrderRow,
  type CollectStatus,
  toClickCollectOrder,
} from "."

export type ListClickCollectOrdersInput = {
  status: CollectStatus
  limit: number
  offset: number
}

/** Board column -> order metadata filter (JSON filters run in Postgres). */
const STATUS_FILTERS: Record<CollectStatus, Record<string, unknown>> = {
  to_pick: { [CollectMeta.READY_AT]: null, [CollectMeta.COLLECTED_AT]: null },
  ready: { [CollectMeta.READY_AT]: { $ne: null }, [CollectMeta.COLLECTED_AT]: null },
  collected: { [CollectMeta.COLLECTED_AT]: { $ne: null } },
}

/**
 * Ids of the order shipping methods that use a shipping option of the native
 * "pickup" fulfillment set (seeded as "Tech Nest pickup").
 *
 * In Medusa 2.21 `query.graph` can't filter orders by
 * `shipping_methods.shipping_option_id`, but it can filter by
 * `shipping_methods.shipping_method_id`, so we look those ids up first.
 */
async function pickupShippingMethodIds(container: MedusaContainer): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "service_zone.fulfillment_set.type"],
  })
  const optionIds = options
    .filter((o) => o.service_zone?.fulfillment_set?.type === "pickup")
    .map((o) => o.id)
  if (!optionIds.length) return []
  const { data: methods } = await query.graph({
    entity: "order_shipping_method",
    fields: ["id"],
    filters: { shipping_option_id: optionIds },
  })
  return methods.map((m) => m.id as string)
}

async function pickupOrderFilters(container: MedusaContainer, status: CollectStatus) {
  const methodIds = await pickupShippingMethodIds(container)
  if (!methodIds.length) return null
  return {
    status: { $nin: ["canceled", "draft"] },
    shipping_methods: { shipping_method_id: methodIds },
    metadata: STATUS_FILTERS[status],
  }
}

/**
 * Click & Collect orders (not cancelled) in one board column, filtered and
 * paginated in the database. `to_pick`/`ready`: oldest first; `collected`:
 * newest first.
 */
export async function listClickCollectOrders(
  container: MedusaContainer,
  { status, limit, offset }: ListClickCollectOrdersInput
): Promise<{ orders: ClickCollectOrder[]; count: number }> {
  const filters = await pickupOrderFilters(container, status)
  if (!filters) return { orders: [], count: 0 }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data, metadata } = await query.graph({
    entity: "order",
    fields: COLLECT_ORDER_FIELDS,
    // The generated filter types don't know the shipping_methods relation filter.
    filters: filters as never,
    pagination: {
      take: limit,
      skip: offset,
      order: { created_at: status === "collected" ? "DESC" : "ASC" },
    },
  })
  return {
    orders: (data as unknown as CollectOrderRow[]).map(toClickCollectOrder),
    count: metadata?.count ?? data.length,
  }
}

/**
 * Every order in the `ready` column (id + metadata only), for the lifecycle
 * job. The column stays small: orders leave it when collected or, at the
 * latest, when the day-7 job cancels them.
 */
export async function listReadyOrders(
  container: MedusaContainer
): Promise<{ id: string; metadata: Record<string, unknown> | null }[]> {
  const filters = await pickupOrderFilters(container, "ready")
  if (!filters) return []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "metadata", "created_at"],
    filters: filters as never,
    pagination: { order: { created_at: "ASC" } },
  })
  return data as unknown as { id: string; metadata: Record<string, unknown> | null }[]
}
