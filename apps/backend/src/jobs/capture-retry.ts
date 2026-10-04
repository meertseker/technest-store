import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { retryUncapturedDeliveryOrders } from "../lib/capture-retry"

/**
 * Every 10 minutes: take the payment of delivery orders that are still only
 * authorised (the order.placed capture failed or never ran). See
 * lib/capture-retry for the retry and give-up rules.
 */
export default async function captureRetryJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const { captured, failed, gave_up } = await retryUncapturedDeliveryOrders(container, new Date())
    if (captured || failed || gave_up) {
      logger.info(`capture-retry: ${captured} captured, ${failed} failed, ${gave_up} given up`)
    }
  } catch (e) {
    // Don't throw from a scheduled job: log and try again next run.
    logger.error(`capture-retry: run failed: ${(e as Error).message}`)
  }
}

export const config = {
  name: "capture-retry",
  schedule: "*/10 * * * *",
}
