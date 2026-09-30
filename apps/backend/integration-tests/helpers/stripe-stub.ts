import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * TEST ONLY. Replaces the Stripe API client inside the running
 * pp_stripe_stripe provider with an in-memory fake, so HTTP tests exercise the
 * real provider code without network or live keys. Webhook signature checks
 * keep Stripe's own (local, offline) `webhooks` helper.
 */
export type StripeStub = {
  created: Record<string, any>[]
  canceled: string[]
  restore: () => void
}

export function stubStripeClient(container: MedusaContainer): StripeStub {
  const paymentModule = container.resolve(Modules.PAYMENT) as any
  const provider = paymentModule.paymentProviderService_.retrieveProvider("pp_stripe_stripe")
  const original = provider.stripe_
  const intents = new Map<string, Record<string, any>>()
  const stub: StripeStub = { created: [], canceled: [], restore: () => (provider.stripe_ = original) }

  provider.stripe_ = {
    webhooks: original.webhooks,
    paymentIntents: {
      create: async (params: Record<string, any>) => {
        stub.created.push(params)
        const id = `pi_stub_${stub.created.length}_${Math.random().toString(36).slice(2, 8)}`
        const intent = {
          id,
          object: "payment_intent",
          status: "requires_payment_method",
          client_secret: `${id}_secret_stub`,
          amount: params.amount,
          currency: params.currency,
          capture_method: params.capture_method,
          metadata: params.metadata,
        }
        intents.set(id, intent)
        return intent
      },
      retrieve: async (id: string) => intents.get(id) ?? { id, status: "requires_payment_method" },
      update: async (id: string, params: Record<string, any>) => ({ ...intents.get(id), ...params, id }),
      cancel: async (id: string) => {
        stub.canceled.push(id)
        return { ...intents.get(id), id, status: "canceled" }
      },
    },
  }
  return stub
}
