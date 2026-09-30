import { MedusaContainer } from "@medusajs/framework"
import { getTechnestSettings } from "../modules/settings/get-settings"
import { applyFreeDeliveryThresholdWorkflow } from "../workflows/apply-free-delivery-threshold"

/**
 * Runs once per database: gives databases seeded before `e1/settings` the
 * free Standard delivery price (default £20 threshold). On a new database the
 * seed already applies it; running again is harmless (the step replaces the
 * conditional price) and a store without a Standard option is skipped.
 */
export default async function apply_free_delivery_threshold({
  container,
}: {
  container: MedusaContainer
}) {
  const { free_delivery_threshold_pence } = await getTechnestSettings(container)
  await applyFreeDeliveryThresholdWorkflow(container).run({
    input: { threshold_pence: free_delivery_threshold_pence },
  })
}
