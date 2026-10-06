import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { reportError } from "../lib/alerting"
import { isLockBusyError } from "../lib/click-collect"
import { RECONCILE_CATCH_UP_MS, reconcilePayments } from "../lib/payment-reconcile"

/** When the last run that finished started. Unknown after a restart: that run catches up on a day. */
let lastRunAt: Date | null = null

/**
 * Every 10 minutes: finish or release payments whose follow-up was lost
 * (paid baskets that never became orders, orders left without a payment).
 * See lib/payment-reconcile for the rules.
 */
export default async function paymentReconcileJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const now = new Date()
  const since = lastRunAt ?? new Date(now.getTime() - RECONCILE_CATCH_UP_MS)
  try {
    // One run at a time: a slow run must not overlap the next.
    const result = await container
      .resolve(Modules.LOCKING)
      .execute("technest-payment-reconcile", () => reconcilePayments(container, now, since), { timeout: 1 })
    // Only a run that finished moves the mark: a failed or skipped run is covered by the next one.
    lastRunAt = now
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
    reportError(e, { source: "job:payment-reconcile" })
  }
}

export const config = {
  name: "payment-reconcile",
  schedule: "5-59/10 * * * *",
}
