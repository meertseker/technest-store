import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { ClickCollectEvents, isLockBusyError } from "../lib/click-collect"
import { captureDeliveryOrderWorkflow } from "../workflows/capture-delivery-order"

/**
 * order.placed -> capture the payment of delivery orders (Stripe runs with
 * capture: false). Click & Collect orders are captured on collection.
 * A refused capture emits technest.payment.capture_failed { order_id } from the
 * capture step. Any other failure (except a duplicate event holding the
 * order's lock, or an unknown order) emits it here, so the shop is always told
 * when a delivery order was left uncaptured.
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
    if (isLockBusyError(e)) {
      // A duplicate delivery of the event is capturing this order right now.
      logger.info(`order.placed capture for order ${data.id} skipped: already in progress`)
      return
    }
    logger.error(`order.placed capture failed for order ${data.id}: ${(e as Error).message}`)
    const type = (e as { type?: string }).type
    if (
      type === MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR || // already emitted by the step
      type === MedusaError.Types.NOT_FOUND
    ) {
      return
    }
    await container
      .resolve(Modules.EVENT_BUS)
      .emit({ name: ClickCollectEvents.CAPTURE_FAILED, data: { order_id: data.id } })
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: { subscriberId: "technest-order-placed-capture" },
}
