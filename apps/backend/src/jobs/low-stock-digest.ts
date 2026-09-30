import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { defaultLowStockThreshold, isLowStockHour, LowStockItem } from "../lib/low-stock"
import { emitLowStockDigestWorkflow } from "../workflows/emit-low-stock-digest"

/**
 * The check itself: emits one `technest.inventory.low_stock` event when any
 * variant is at or below its reorder level. Tests call this directly.
 */
export async function runLowStockCheck(
  container: MedusaContainer,
  env: NodeJS.ProcessEnv = process.env
): Promise<LowStockItem[]> {
  const { result } = await emitLowStockDigestWorkflow(container).run({
    input: { fallback_threshold: defaultLowStockThreshold(env) },
  })
  return result.items
}

/**
 * Daily at 08:00 Europe/London (the email contract's time). Medusa's cron runs
 * in the server's time zone (UTC in our containers), so the job runs hourly and
 * only acts in the London 08:00 hour, which stays right across BST/GMT.
 * E2's email sends at most one digest per London day, so a re-run is harmless.
 */
export default async function lowStockDigestJob(container: MedusaContainer) {
  if (!isLowStockHour()) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const items = await runLowStockCheck(container)
    logger.info(`Low-stock check: ${items.length} variant(s) at or below reorder level.`)
  } catch (error) {
    logger.error(`Low-stock check failed: ${(error as Error).message}`)
  }
}

export const config = {
  name: "technest-low-stock-digest",
  schedule: "0 * * * *",
}
