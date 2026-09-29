import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

export const STRIPE_PROVIDER_ID = "pp_stripe_stripe"

/**
 * Makes Stripe the ONLY payment provider on the GBP region(s). Idempotent.
 * pp_system_default completes orders without taking payment, so it must not
 * stay enabled where real customers check out.
 *
 *   cd apps/backend && pnpm exec medusa exec ./src/scripts/enable-stripe.ts
 *
 * Needs STRIPE_API_KEY set (the provider is only registered then).
 */
export default async function enableStripe({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const paymentModule = container.resolve(Modules.PAYMENT)

  const providers = await paymentModule.listPaymentProviders({ id: [STRIPE_PROVIDER_ID] })
  if (!providers.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `${STRIPE_PROVIDER_ID} is not registered. Set STRIPE_API_KEY and restart.`
    )
  }

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "payment_providers.id"],
    filters: { currency_code: "gbp" },
  })

  for (const region of regions) {
    const current = (region.payment_providers ?? []).map((p) => p?.id)
    if (current.length === 1 && current[0] === STRIPE_PROVIDER_ID) {
      logger.info(`enable-stripe: region ${region.name} already uses Stripe only`)
      continue
    }
    await updateRegionsWorkflow(container).run({
      input: { selector: { id: region.id }, update: { payment_providers: [STRIPE_PROVIDER_ID] } },
    })
    logger.info(`enable-stripe: region ${region.name} now uses ${STRIPE_PROVIDER_ID} only`)
  }
}
