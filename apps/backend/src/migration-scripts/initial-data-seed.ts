import { MedusaContainer } from "@medusajs/framework"
import { demoDataEnabled, seedTechNest } from "../scripts/seed"

/**
 * Runs once per database, on the first `medusa db:migrate`.
 * The seed itself lives in src/scripts/seed so integration tests can reuse it.
 * Sample products only with SEED_DEMO_DATA=true, so a production migrate
 * creates the real configuration (region, location, shipping, categories) only.
 */
export default async function initial_data_seed({
  container,
}: {
  container: MedusaContainer
}) {
  await seedTechNest(container, { demo: demoDataEnabled() })
}
