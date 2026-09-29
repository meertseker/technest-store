import StripeProviderService from "@medusajs/payment-stripe/dist/services/stripe-provider"
import { getSmallestUnit } from "@medusajs/payment-stripe/dist/utils/get-smallest-unit"
import type { StripeOptions } from "@medusajs/payment-stripe/dist/types"
import { isPresent } from "@medusajs/framework/utils"
import type {
  InitiatePaymentInput,
  InitiatePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
} from "@medusajs/framework/types"

export type TechNestStripeOptions = StripeOptions & {
  /** Baskets below this (in pence) never see Klarna. */
  klarnaMinBasketPence?: number | string
}

// Private key for passing the server-side decision from initiatePayment into
// normalizePaymentIntentParameters. Client data never reaches that method.
const EXCLUDED = Symbol("technest.excluded_payment_method_types")

/**
 * Medusa's Stripe provider with two changes (see docs/adr/0002):
 *  1. Client-sent `data` is ignored: the stock provider forwards it into the
 *     PaymentIntent (capture_method, payment_method_types, confirm, ...).
 *  2. Klarna is excluded below `klarnaMinBasketPence`, re-checked whenever the
 *     amount changes.
 * Same identifier as the stock provider, so the id stays pp_stripe_stripe and
 * the webhook stays /hooks/payment/stripe_stripe.
 */
class TechNestStripeService extends StripeProviderService {
  static identifier = "stripe"

  // StripeBase.getStatus is TS-private but a normal method at runtime; the unit
  // tests exercise it, so an upstream rename fails loudly.
  protected status_(intent: unknown): UpdatePaymentOutput {
    return (this as unknown as { getStatus(i: unknown): UpdatePaymentOutput }).getStatus(intent)
  }

  protected get klarnaMinPence_(): number {
    const value = Number((this.options_ as TechNestStripeOptions).klarnaMinBasketPence ?? 3000)
    return Number.isFinite(value) ? value : 3000
  }

  protected excludedTypes_(amountPence: number): string[] {
    return amountPence < this.klarnaMinPence_ ? ["klarna"] : []
  }

  normalizePaymentIntentParameters(extra?: Record<string | symbol, unknown>) {
    const params = super.normalizePaymentIntentParameters(undefined)
    const excluded = extra?.[EXCLUDED] as string[] | undefined
    if (excluded?.length) {
      ;(params as Record<string, unknown>).excluded_payment_method_types = excluded
    }
    return params
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const amountPence = getSmallestUnit(input.amount, input.currency_code)
    return super.initiatePayment({
      ...input,
      data: {
        session_id: input.data?.session_id,
        [EXCLUDED]: this.excludedTypes_(amountPence),
      } as Record<string, unknown>,
    })
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const { data, amount, currency_code, context } = input
    const amountPence = getSmallestUnit(amount, currency_code)
    if (isPresent(amount) && data?.amount === amountPence) {
      return this.status_(data)
    }

    const excluded = this.excludedTypes_(amountPence)
    try {
      const intent = await this.stripe_.paymentIntents.update(
        data?.id as string,
        {
          amount: amountPence,
          expand: ["payment_method"],
          // "" clears a previous exclusion (Stripe's way to unset an array).
          excluded_payment_method_types: excluded.length ? excluded : "",
        } as any,
        { idempotencyKey: context?.idempotency_key }
      )
      return this.status_(intent)
    } catch (e) {
      throw this.buildError("An error occurred in updatePayment", e as Error)
    }
  }
}

export default TechNestStripeService
