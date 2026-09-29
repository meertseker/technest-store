import { MedusaContainer } from "@medusajs/framework"
import { seedTechNest } from "../scripts/seed"

/**
 * Runs once per database, on the first `medusa db:migrate`.
 * The seed itself lives in src/scripts/seed so integration tests can reuse it.
 */
export default async function initial_data_seed({
  container,
}: {
  container: MedusaContainer
}) {
  await seedTechNest(container)
}
