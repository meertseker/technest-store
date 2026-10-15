import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { collectStatusOf, CollectMeta, loadPickupOrder, paymentsOf } from "../../../lib/click-collect"
import { PaymentNoticeMeta } from "../../../lib/stripe-events/constants"

export type HandedOverFulfillment = {
  id: string
  shipped_at?: string | Date | null
  delivered_at?: string | Date | null
  canceled_at?: string | Date | null
  items?: ({ line_item_id?: string | null; quantity?: unknown } | null)[] | null
}

export type OrderLine = { id: string; quantity?: unknown }

/** Fields to load on an order for {@link handOverOf}. */
export const HAND_OVER_FIELDS = [
  "items.id",
  "items.quantity",
  // The order module only loads a line's quantity together with its detail.
  "items.detail.quantity",
  "fulfillments.id",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
  "fulfillments.items.line_item_id",
  "fulfillments.items.quantity",
]

export type HandOver = {
  /** True when delivered/shipped fulfilments cover every unit of every line. */
  complete: boolean
  /** The first fulfilment marked delivered or shipped. */
  fulfillment_id: string
}

/**
 * Whether goods left through fulfilments marked delivered or shipped (not
 * cancelled) on Medusa's order page: null when none did, otherwise whether
 * they cover the whole order. Only a complete hand-over counts as collected.
 */
export function handOverOf(
  items: (OrderLine | null | undefined)[] | null | undefined,
  fulfillments: (HandedOverFulfillment | null | undefined)[] | null | undefined
): HandOver | null {
  const out = (fulfillments ?? []).filter(
    (f): f is HandedOverFulfillment => !!f && !f.canceled_at && !!(f.delivered_at || f.shipped_at)
  )
  if (!out.length) return null
  const given = new Map<string, number>()
  for (const f of out) {
    for (const item of f.items ?? []) {
      if (!item?.line_item_id) continue
      given.set(item.line_item_id, (given.get(item.line_item_id) ?? 0) + (Number(item.quantity) || 0))
    }
  }
  const lines = (items ?? []).filter((i): i is OrderLine => !!i)
  // A line whose quantity didn't load counts as not handed over: never charge on a guess.
  const complete =
    lines.length > 0 &&
    lines.every((i) => Number(i.quantity) > 0 && (given.get(i.id) ?? 0) >= Number(i.quantity))
  return { complete, fulfillment_id: out[0].id }
}

export type PrepareOutsideBoardOutput = {
  /** True when the order was handed over outside the board and isn't recorded as collected yet. */
  due: boolean
  fulfillment_id: string | null
  /** Authorised payments still to capture. */
  payment_ids: string[]
  patch: Record<string, unknown>
}

const NOT_DUE: PrepareOutsideBoardOutput = { due: false, fulfillment_id: null, payment_ids: [], patch: {} }

/**
 * Re-reads a Click & Collect order under its lock: due when it isn't
 * cancelled or collected and fulfilments marked delivered or shipped from
 * Medusa's own order page cover the whole order. Refuses (so nothing is marked
 * collected) when no payment is left to capture and none was captured: the
 * goods left without money, which staff must sort out.
 */
export const prepareOutsideBoardStep = createStep(
  "prepare-collected-outside-board",
  async ({ order_id }: { order_id: string }, { container }) => {
    const order = await loadPickupOrder(container, order_id)
    if (order.status === "canceled" || collectStatusOf(order.metadata) === "collected") {
      return new StepResponse(NOT_DUE)
    }
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["id", ...HAND_OVER_FIELDS],
      filters: { id: order_id },
    })
    const row = data[0] as { items?: OrderLine[]; fulfillments?: HandedOverFulfillment[] } | undefined
    const handOver = handOverOf(row?.items, row?.fulfillments)
    if (!handOver?.complete) return new StepResponse(NOT_DUE)
    const fulfillment = { id: handOver.fulfillment_id }

    const payments = paymentsOf(order).filter((p) => !p.canceled_at)
    if (!payments.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Order ${order_id} was handed over outside the Click & Collect board but has no payment left to capture`
      )
    }
    const at = new Date().toISOString()
    return new StepResponse<PrepareOutsideBoardOutput>({
      due: true,
      fulfillment_id: fulfillment.id,
      payment_ids: payments.filter((p) => !p.captured_at).map((p) => p.id),
      patch: {
        [CollectMeta.COLLECTED_AT]: at,
        [PaymentNoticeMeta.COLLECTED_OUTSIDE_BOARD]: { fulfillment_id: fulfillment.id, at },
      },
    })
  }
)
