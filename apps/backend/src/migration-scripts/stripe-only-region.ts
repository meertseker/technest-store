import { MedusaContainer } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import enableStripe, { STRIPE_PROVIDER_ID } from "../scripts/enable-stripe"

/**
 * Runs once per database. The first seed used to give the GBP region Medusa's
 * "no payment" provider whatever was configured; a database seeded that way
 * gets Stripe as its only provider here. Without Stripe registered (local
 * work, no STRIPE_API_KEY) it changes nothing.
 */
export default async function stripe_only_region({
  container,
}: {
  container: MedusaContainer
}) {
  const providers = await container
    .resolve(Modules.PAYMENT)
    .listPaymentProviders({ id: [STRIPE_PROVIDER_ID] })
  if (!providers.some((p) => p.is_enabled)) return

  await enableStripe({ container, args: [] })
}
