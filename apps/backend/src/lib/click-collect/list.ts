import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  COLLECT_ORDER_FIELDS,
  CollectMeta,
  type ClickCollectOrder,
  type CollectOrderRow,
  type CollectStatus,
  toClickCollectOrder,
} from "."
import type { HandedOverFulfillment } from "../../workflows/steps/click-collect/prepare-outside-board"

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
 * Ids of the shipping options of the native "pickup" fulfillment set (seeded
 * as "Tech Nest pickup"). A handful at most, however many orders there are.
 */
async function pickupShippingOptionIds(container: MedusaContainer): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "service_zone.fulfillment_set.type"],
  })
  return options.filter((o) => o.service_zone?.fulfillment_set?.type === "pickup").map((o) => o.id)
}

/**
 * Order filter: not cancelled, shipped with one of those options. Given to the
 * order module itself, which joins order -> order_shipping ->
 * order_shipping_method in one query, so the filter has the same size however
 * many pickup orders exist. (`query.graph` can't take this nested filter: it
 * remaps `shipping_methods` to the public shape and drops the join.)
 */
const pickupOrderWhere = (optionIds: string[], metadata: Record<string, unknown>) => ({
  status: { $nin: ["canceled", "draft"] },
  shipping_methods: { shipping_method: { shipping_option_id: optionIds } },
  metadata,
})

type OrderPage = { take: number; skip: number; order: Record<string, "ASC" | "DESC"> }

/** One page of matching order ids, and the total, counted in the database. */
async function pickupOrderIds(
  container: MedusaContainer,
  where: ReturnType<typeof pickupOrderWhere>,
  { take, skip, order }: OrderPage
): Promise<[string[], number]> {
  const orders = container.resolve(Modules.ORDER)
  const [rows, count] = await orders.listAndCountOrders(
    // The generated filter types don't know the nested shipping_methods relation filter.
    where as never,
    { select: ["id"], take, skip, order }
  )
  return [rows.map((o) => o.id), count]
}

/** The orders with these ids (one page at most), in the order of `ids`. */
async function ordersByIds<T extends { id: string }>(
  container: MedusaContainer,
  ids: string[],
  fields: string[]
): Promise<T[]> {
  if (!ids.length) return []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields, filters: { id: ids } })
  const byId = new Map((data as unknown as T[]).map((o) => [o.id, o]))
  return ids.map((id) => byId.get(id)).filter((o): o is T => !!o)
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
  const optionIds = await pickupShippingOptionIds(container)
  if (!optionIds.length) return { orders: [], count: 0 }

  const [ids, count] = await pickupOrderIds(container, pickupOrderWhere(optionIds, STATUS_FILTERS[status]), {
    take: limit,
    skip: offset,
    order: { created_at: status === "collected" ? "DESC" : "ASC" },
  })
  const rows = await ordersByIds<CollectOrderRow>(container, ids, COLLECT_ORDER_FIELDS)
  return { orders: rows.map(toClickCollectOrder), count }
}

export type UncollectedOrderRow = {
  id: string
  created_at: string | Date
  metadata: Record<string, unknown> | null
  fulfillments?: HandedOverFulfillment[] | null
}

const UNCOLLECTED_PAGE = 100

/**
 * Every Click & Collect order not collected yet, ready or not (id, metadata,
 * order time and fulfilment dates only), oldest first, for the lifecycle job.
 * The list stays small: orders leave it when collected or, at the latest, when
 * the job cancels them at their collection deadline. Read a page at a time.
 */
export async function listUncollectedOrders(container: MedusaContainer): Promise<UncollectedOrderRow[]> {
  const optionIds = await pickupShippingOptionIds(container)
  if (!optionIds.length) return []
  const where = pickupOrderWhere(optionIds, { [CollectMeta.COLLECTED_AT]: null })
  const fields = [
    "id",
    "metadata",
    "created_at",
    "fulfillments.id",
    "fulfillments.shipped_at",
    "fulfillments.delivered_at",
    "fulfillments.canceled_at",
  ]
  const all: UncollectedOrderRow[] = []
  for (let skip = 0; ; skip += UNCOLLECTED_PAGE) {
    const [ids, count] = await pickupOrderIds(container, where, {
      take: UNCOLLECTED_PAGE,
      skip,
      order: { created_at: "ASC" },
    })
    all.push(...(await ordersByIds<UncollectedOrderRow>(container, ids, fields)))
    if (!ids.length || skip + UNCOLLECTED_PAGE >= count) return all
  }
}
