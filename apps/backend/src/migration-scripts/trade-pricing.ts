import { MedusaContainer } from "@medusajs/framework"
import { ensureTradePricing } from "../scripts/seed/trade-pricing"

/** Runs once per database: "Trade" customer group + empty "Trade" price list. */
export default async function trade_pricing({
  container,
}: {
  container: MedusaContainer
}) {
  await ensureTradePricing(container)
}
