import { MedusaContainer } from "@medusajs/framework"
import { seedPromotions } from "../scripts/seed/promotions"

/**
 * Runs once per database, after initial-data-seed (scripts run in name order):
 * the automatic "any 3 £1 add-ons for £2" promotion. Idempotent.
 */
export default async function seed_promotions({
  container,
}: {
  container: MedusaContainer
}) {
  await seedPromotions(container)
}
