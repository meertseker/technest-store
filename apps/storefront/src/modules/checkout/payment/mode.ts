import "server-only"
import { listCartPaymentMethods } from "@lib/data/payment"
import { resolvePaymentMode, type PaymentMode } from "./helpers"

/** Publishable key only (pk_test_... in dev). Secret keys never reach the storefront. */
export function stripePublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_STRIPE_KEY || undefined
}

/**
 * Server-side decision of the payment path. The server actions call this again
 * instead of trusting anything the browser sends.
 */
export async function getPaymentMode(regionId: string): Promise<PaymentMode> {
  const providers = (await listCartPaymentMethods(regionId)) ?? []
  return resolvePaymentMode({
    nodeEnv: process.env.NODE_ENV,
    stripeKey: stripePublishableKey(),
    providerIds: providers.map((p) => p.id),
  })
}
