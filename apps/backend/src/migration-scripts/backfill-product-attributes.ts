import { MedusaContainer } from "@medusajs/framework"
import { backfillProductAttributes } from "../scripts/seed/backfill-attributes"

/**
 * Runs once per database. Dev databases seeded before ADR 0001 keep their
 * attributes in metadata; this moves them into the productAttributes module.
 * A no-op on new databases (the seed writes the module directly).
 */
export default async function backfill_product_attributes({
  container,
}: {
  container: MedusaContainer
}) {
  await backfillProductAttributes(container)
}
