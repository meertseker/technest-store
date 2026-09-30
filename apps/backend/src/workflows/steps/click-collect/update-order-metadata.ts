import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type UpdateOrderMetadataInput = {
  order_id: string
  /** Keys to set. Other metadata keys are kept. */
  patch: Record<string, unknown>
}

/**
 * Merges `patch` into the order's metadata. Compensation writes the previous
 * metadata back. Callers hold the order's Click & Collect lock.
 */
export const updateOrderMetadataStep = createStep(
  "technest-update-order-metadata",
  async (input: UpdateOrderMetadataInput, { container }) => {
    const orders = container.resolve(Modules.ORDER)
    const order = await orders.retrieveOrder(input.order_id, { select: ["id", "metadata"] })
    const previous = (order.metadata ?? {}) as Record<string, unknown>
    const next = { ...previous, ...input.patch }
    await orders.updateOrders(input.order_id, { metadata: next })
    return new StepResponse(next, { order_id: input.order_id, previous })
  },
  async (comp, { container }) => {
    if (!comp) return
    await container.resolve(Modules.ORDER).updateOrders(comp.order_id, { metadata: comp.previous })
  }
)
