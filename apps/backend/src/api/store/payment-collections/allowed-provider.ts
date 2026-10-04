import { MedusaError } from "@medusajs/framework/utils"
import { STRIPE_PROVIDER_ID } from "../../../scripts/enable-stripe"

/**
 * In production a payment session can only be opened with Stripe. Medusa
 * checks the provider against the cart's region, and the region should offer
 * Stripe only, but a region is editable in the admin: if the "no payment"
 * provider (pp_system_default) were ever added back there, anyone with the
 * public key could complete an order without paying.
 */
export function assertPaymentProviderAllowed(
  providerId: string,
  env: { NODE_ENV?: string } = process.env
) {
  if (env.NODE_ENV === "production" && providerId !== STRIPE_PROVIDER_ID) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This payment method isn't available.")
  }
}
