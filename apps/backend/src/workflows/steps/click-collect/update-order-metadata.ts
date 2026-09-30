import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type UpdateOrderMetadataInput = {
  order_id: string
  /** Keys to set. Other metadata keys are kept. */
  patch: Record<string, unknown>
}

/**
 * Sets the `patch` keys in the order's metadata. The order module merges
 * metadata (an empty string deletes a key), so compensation writes back the
 * previous value of each patched key, or "" for keys that did not exist.
 * Callers hold the order's Click & Collect lock.
 */
export const updateOrderMetadataStep = createStep(
  "update-order-metadata",
  async (input: UpdateOrderMetadataInput, { container }) => {
    const orders = container.resolve(Modules.ORDER)
    const order = await orders.retrieveOrder(input.order_id, { select: ["id", "metadata"] })
    const previous = (order.metadata ?? {}) as Record<string, unknown>
    const restore = Object.fromEntries(
      Object.keys(input.patch).map((key) => [key, key in previous ? previous[key] : ""])
    )
    await orders.updateOrders(input.order_id, { metadata: input.patch })
    return new StepResponse({ ...previous, ...input.patch }, { order_id: input.order_id, restore })
  },
  async (comp, { container }) => {
    if (!comp) return
    await container.resolve(Modules.ORDER).updateOrders(comp.order_id, { metadata: comp.restore })
  }
)
