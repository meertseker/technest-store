import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { reportError } from "../lib/alerting"
import { isLockBusyError } from "../lib/click-collect"
import { retryUncapturedDeliveryOrders } from "../lib/capture-retry"

/**
 * Every 10 minutes: take the payment of delivery orders that are still only
 * authorised (the order.placed capture failed or never ran). See
 * lib/capture-retry for the retry and give-up rules.
 */
export default async function captureRetryJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    // One run at a time: a slow run (a payment outage) must not overlap the next.
    const { captured, failed, gave_up } = await container
      .resolve(Modules.LOCKING)
      .execute("technest-capture-retry", () => retryUncapturedDeliveryOrders(container, new Date()), {
        timeout: 1,
      })
    if (captured || failed || gave_up) {
      logger.info(`capture-retry: ${captured} captured, ${failed} failed, ${gave_up} given up`)
    }
  } catch (e) {
    if (isLockBusyError(e)) return
    // Don't throw from a scheduled job: log and try again next run.
    logger.error(`capture-retry: run failed: ${(e as Error).message}`)
    reportError(e, { source: "job:capture-retry" })
  }
}

export const config = {
  name: "capture-retry",
  schedule: "*/10 * * * *",
}
