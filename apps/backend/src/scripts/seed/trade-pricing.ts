import { MedusaContainer } from "@medusajs/framework"
import { ensureTradePricingWorkflow } from "../../workflows/ensure-trade-pricing"

/**
 * Creates the "Trade" customer group and an empty "Trade" price list scoped to
 * it, unless they already exist. Safe to run any number of times.
 */
export async function ensureTradePricing(container: MedusaContainer) {
  const { result } = await ensureTradePricingWorkflow(container).run()
  return result
}
