import { MedusaContainer } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { demoDataEnabled, seedTechNest } from "../scripts/seed"
import { STRIPE_PROVIDER_ID } from "../scripts/enable-stripe"

/**
 * Stripe as the region's only provider once it is registered (STRIPE_API_KEY
 * set, which production requires to boot). Without it (local work) the region
 * gets Medusa's "no payment" provider, which completes orders without taking
 * money and must never be offered to real customers.
 */
async function regionPaymentProviders(container: MedusaContainer) {
  const providers = await container
    .resolve(Modules.PAYMENT)
    .listPaymentProviders({ id: [STRIPE_PROVIDER_ID] })
  return providers.some((p) => p.is_enabled) ? [STRIPE_PROVIDER_ID] : ["pp_system_default"]
}

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
  await seedTechNest(container, {
    demo: demoDataEnabled(),
    paymentProviders: await regionPaymentProviders(container),
  })
}
