import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reportError } from "../lib/alerting"
import { isLockBusyError } from "../lib/click-collect"
import { captureDeliveryOrderWorkflow } from "../workflows/capture-delivery-order"

/**
 * order.placed -> capture the payment of delivery orders (Stripe runs with
 * capture: false). Click & Collect orders are captured on collection.
 *
 * A capture that fails here is not final: the capture-retry job
 * (lib/capture-retry) tries again and emits technest.payment.capture_failed
 * when it gives up, so the shopper isn't told about a blip that the next
 * attempt fixes. Meanwhile the order can't be marked shipped.
 *
 * A held lock is thrown, not swallowed: it may belong to a worker that died
 * mid-capture, so the event bus retries this subscriber and the job is the
 * backstop.
 */
export default async function orderPlacedCapture({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await captureDeliveryOrderWorkflow(container).run({
      input: { order_id: data.id, notify_on_failure: false },
    })
  } catch (e) {
    if (isLockBusyError(e)) throw e
    // IDs only in logs: never card data or customer details.
    logger.error(
      `order.placed capture failed for order ${data.id}, the capture-retry job will try again: ${(e as Error).message}`
    )
    reportError(e, { source: "subscriber:order-placed-capture", order_id: data.id })
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: { subscriberId: "technest-order-placed-capture" },
}
