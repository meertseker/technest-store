import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  loadDeliveryOrder,
  paymentBlocker,
  shippedAtOf,
  unfulfilledItems,
} from "../../../lib/delivery"

export type PrepareShipmentOutput = {
  /** True when a shipment already exists: nothing to do. */
  already_shipped: boolean
  /** The live fulfilment that shipped, when already shipped. */
  fulfillment_id: string | null
  /** Order items (and quantities) not fulfilled yet. */
  items: { id: string; quantity: number }[]
}

/**
 * Validates that a delivery order can be marked shipped: not Click & Collect,
 * not cancelled, and paid for (payment captured, not refunded in full).
 * Shipping an order a second time is a no-op.
 */
export const prepareShipmentStep = createStep(
  "prepare-shipment",
  async ({ order_id }: { order_id: string }, { container }) => {
    const order = await loadDeliveryOrder(container, order_id)
    const shippedAt = shippedAtOf(order)
    if (shippedAt) {
      const shipped = (order.fulfillments ?? []).find(
        (f) => !!f && !f.canceled_at && !!f.shipped_at
      )
      return new StepResponse<PrepareShipmentOutput>({
        already_shipped: true,
        fulfillment_id: shipped?.id ?? null,
        items: [],
      })
    }
    if (order.status === "canceled") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Order ${order_id} is cancelled`)
    }
    const unpaid = paymentBlocker(order)
    if (unpaid) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, unpaid)
    }
    const items = unfulfilledItems(order)
    if (!items.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Order ${order_id} has nothing left to ship`
      )
    }
    return new StepResponse<PrepareShipmentOutput>({
      already_shipped: false,
      fulfillment_id: null,
      items,
    })
  }
)
