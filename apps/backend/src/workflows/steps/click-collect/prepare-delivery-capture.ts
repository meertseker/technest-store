import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { COLLECT_ORDER_FIELDS, type CollectOrderRow, paymentsOf } from "../../../lib/click-collect"
import { isPickupOrder } from "../../../lib/email/order-email-data"

export type PrepareDeliveryCaptureOutput = {
  /** Why nothing is captured, or null when `payment_ids` should be captured. */
  skipped: "pickup" | "canceled" | "nothing_to_capture" | null
  payment_ids: string[]
}

/**
 * Delivery orders are captured right after order.placed. Click & Collect
 * orders are skipped (captured on collection). Already captured or cancelled
 * payments are skipped, so a duplicate event never captures twice.
 */
export const prepareDeliveryCaptureStep = createStep(
  "prepare-delivery-capture",
  async ({ order_id }: { order_id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: COLLECT_ORDER_FIELDS,
      filters: { id: order_id },
    })
    const order = data[0] as unknown as CollectOrderRow | undefined
    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${order_id} not found`)
    }
    const pickup = await isPickupOrder(
      container,
      (order.shipping_methods ?? []).map((m) => m?.shipping_option_id)
    )
    const ids = paymentsOf(order)
      .filter((p) => !p.captured_at && !p.canceled_at)
      .map((p) => p.id)
    const skipped: PrepareDeliveryCaptureOutput["skipped"] = pickup
      ? "pickup"
      : order.status === "canceled"
        ? "canceled"
        : ids.length
          ? null
          : "nothing_to_capture"
    return new StepResponse<PrepareDeliveryCaptureOutput>({
      skipped,
      payment_ids: skipped ? [] : ids,
    })
  }
)
