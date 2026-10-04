import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { isLockBusyError } from "../lib/click-collect"
import { reconcilePayments } from "../lib/payment-reconcile"

/**
 * Every 10 minutes: finish or release payments whose follow-up was lost
 * (paid baskets that never became orders, orders left without a payment).
 * See lib/payment-reconcile for the rules.
 */
export default async function paymentReconcileJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    // One run at a time: a slow run must not overlap the next.
    const result = await container
      .resolve(Modules.LOCKING)
      .execute("technest-payment-reconcile", () => reconcilePayments(container, new Date()), { timeout: 1 })
    if (result.orders_placed || result.holds_released || result.payments_authorised) {
      logger.info(
        `payment-reconcile: ${result.orders_placed} orders placed, ${result.holds_released} holds released, ` +
          `${result.payments_authorised} payments authorised`
      )
    }
  } catch (e) {
    if (isLockBusyError(e)) return
    // Don't throw from a scheduled job: log and try again next run.
    logger.error(`payment-reconcile: run failed: ${(e as Error).message}`)
  }
}

export const config = {
  name: "payment-reconcile",
  schedule: "5-59/10 * * * *",
}
