import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { collectStatusOf, CollectMeta, loadPickupOrder, paymentsOf } from "../../../lib/click-collect"
import { PaymentNoticeMeta } from "../../../lib/stripe-events/constants"

export type HandedOverFulfillment = {
  id: string
  shipped_at?: string | Date | null
  delivered_at?: string | Date | null
  canceled_at?: string | Date | null
}

/** The first fulfilment marked delivered or shipped (and not cancelled), if any. */
export function handedOverFulfillment(
  fulfillments: (HandedOverFulfillment | null | undefined)[] | null | undefined
): HandedOverFulfillment | null {
  return (
    (fulfillments ?? []).find(
      (f): f is HandedOverFulfillment => !!f && !f.canceled_at && !!(f.delivered_at || f.shipped_at)
    ) ?? null
  )
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
 * cancelled or collected and one of its fulfilments was marked delivered or
 * shipped from Medusa's own order page. Refuses (so nothing is marked
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
      fields: ["id", "fulfillments.id", "fulfillments.shipped_at", "fulfillments.delivered_at", "fulfillments.canceled_at"],
      filters: { id: order_id },
    })
    const fulfillment = handedOverFulfillment((data[0] as { fulfillments?: HandedOverFulfillment[] } | undefined)?.fulfillments)
    if (!fulfillment) return new StepResponse(NOT_DUE)

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
