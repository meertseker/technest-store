import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  collectStatusOf,
  CollectMeta,
  loadPickupOrder,
  paymentsOf,
} from "../../../lib/click-collect"

export type PrepareCollectionOutput = {
  /** True when the order was already collected: nothing to do. */
  already_collected: boolean
  /** Authorised payments that still need capturing. */
  payment_ids: string[]
  /** Order items (and quantities) that are not fulfilled yet. */
  items: { id: string; quantity: number }[]
  patch: Record<string, unknown>
}

/**
 * Validates that a Click & Collect order can be handed over: marked ready,
 * not cancelled, and paid by an authorised (or already captured) payment.
 */
export const prepareCollectionStep = createStep(
  "prepare-collection",
  async ({ order_id }: { order_id: string }, { container }) => {
    const order = await loadPickupOrder(container, order_id)
    const status = collectStatusOf(order.metadata)
    if (status === "collected") {
      return new StepResponse<PrepareCollectionOutput>({
        already_collected: true,
        payment_ids: [],
        items: [],
        patch: {},
      })
    }
    if (order.status === "canceled") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Order ${order_id} is cancelled`)
    }
    if (status !== "ready") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Order ${order_id} must be marked ready before it is collected`
      )
    }

    const payments = paymentsOf(order).filter((p) => !p.canceled_at)
    if (!payments.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Order ${order_id} has no authorised payment to capture`
      )
    }

    const items = (order.items ?? [])
      .filter((i): i is NonNullable<typeof i> => !!i)
      .map((i) => ({
        id: i.id,
        quantity: Number(i.quantity) - Number(i.detail?.fulfilled_quantity ?? 0),
      }))
      .filter((i) => i.quantity > 0)

    return new StepResponse<PrepareCollectionOutput>({
      already_collected: false,
      payment_ids: payments.filter((p) => !p.captured_at).map((p) => p.id),
      items,
      patch: { [CollectMeta.COLLECTED_AT]: new Date().toISOString() },
    })
  }
)
