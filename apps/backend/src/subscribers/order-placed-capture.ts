import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ClickCollectEvents } from "../lib/click-collect"
import { captureDeliveryOrderWorkflow } from "../workflows/capture-delivery-order"

/**
 * order.placed -> capture the payment of delivery orders (Stripe runs with
 * capture: false). Click & Collect orders are captured on collection.
 * On failure emits technest.payment.capture_failed { order_id }.
 */
export default async function orderPlacedCapture({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await captureDeliveryOrderWorkflow(container).run({ input: { order_id: data.id } })
  } catch (e) {
    // IDs only in logs: never card data or customer details.
    logger.error(`order.placed capture failed for order ${data.id}: ${(e as Error).message}`)
    await container
      .resolve(Modules.EVENT_BUS)
      .emit({ name: ClickCollectEvents.CAPTURE_FAILED, data: { order_id: data.id } })
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: { subscriberId: "technest-order-placed-capture" },
}
