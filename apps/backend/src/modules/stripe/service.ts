// @medusajs/payment-stripe has no public export for the provider class or its
// amount helper; subclassing it is the point of this module (ADR 0002).
// eslint-disable-next-line @medusajs/import-from-framework-not-internal
import StripeProviderService from "@medusajs/payment-stripe/dist/services/stripe-provider"
// eslint-disable-next-line @medusajs/import-from-framework-not-internal
import { getSmallestUnit } from "@medusajs/payment-stripe/dist/utils/get-smallest-unit"
import { isPresent, MedusaError } from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
} from "@medusajs/framework/types"

export type TechNestStripeOptions = {
  apiKey: string
  webhookSecret?: string
  capture?: boolean
  automaticPaymentMethods?: boolean
  paymentDescription?: string
  /** Baskets below this (in pence) never see Klarna. */
  klarnaMinBasketPence?: number | string
}

/**
 * Server-side payment session context key carrying the admin-set Klarna
 * minimum (integer pence). Set only by the `create-technest-payment-sessions`
 * workflow from the settings module; payment session `context` never comes
 * from the client. See docs/contracts/payments.md.
 */
export const KLARNA_MIN_CONTEXT_KEY = "technest_klarna_min_basket_pence"

/** Fields this provider adds to the payment session data (docs/contracts/payments.md). */
export type KlarnaSessionData = {
  /** true when Klarna is offered for this session's amount. */
  klarna_available: boolean
  /** The minimum (integer pence, inc. VAT) this decision used. */
  klarna_min_basket_pence: number
}

const isPence = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0

// Private key for passing the server-side decision from initiatePayment into
// normalizePaymentIntentParameters. Client data never reaches that method.
const EXCLUDED = Symbol("technest.excluded_payment_method_types")

/**
 * Medusa's Stripe provider with two changes (see docs/adr/0002):
 *  1. Client-sent `data` is ignored: the stock provider forwards it into the
 *     PaymentIntent (capture_method, payment_method_types, confirm, ...).
 *  2. Klarna is excluded below the admin-set minimum basket (settings module,
 *     passed in the session context; `klarnaMinBasketPence` option as the
 *     fallback), re-checked whenever the amount changes. The decision is
 *     exposed to the storefront as `klarna_available` in the session data.
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

  /** Fallback minimum from provider options (env KLARNA_MIN_BASKET_PENCE), default 3000. */
  protected get klarnaMinPence_(): number {
    const value = Number((this.options_ as unknown as TechNestStripeOptions).klarnaMinBasketPence ?? 3000)
    return Number.isFinite(value) ? value : 3000
  }

  /**
   * The Klarna minimum for this call: the admin setting passed server-side in
   * the session context, else the one stored on the session when it was
   * created, else the provider option.
   */
  protected klarnaMinFor_(
    context?: Record<string, unknown> | null,
    data?: Record<string, unknown> | null
  ): number {
    const fromContext = context?.[KLARNA_MIN_CONTEXT_KEY]
    if (isPence(fromContext)) return fromContext
    const fromSession = data?.klarna_min_basket_pence
    if (isPence(fromSession)) return fromSession
    return this.klarnaMinPence_
  }

  protected klarna_(amountPence: number, minPence: number): KlarnaSessionData {
    return { klarna_available: amountPence >= minPence, klarna_min_basket_pence: minPence }
  }

  protected excludedTypes_(klarna: KlarnaSessionData): string[] {
    return klarna.klarna_available ? [] : ["klarna"]
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
    const klarna = this.klarna_(
      amountPence,
      this.klarnaMinFor_(input.context as Record<string, unknown> | undefined)
    )
    const result = await super.initiatePayment({
      ...input,
      data: {
        session_id: input.data?.session_id,
        [EXCLUDED]: this.excludedTypes_(klarna),
      } as Record<string, unknown>,
    })
    // Session data = the PaymentIntent plus the Klarna flag for the storefront.
    return { ...result, data: { ...result.data, ...klarna } }
  }

  /**
   * Medusa stores `{ ...clientData, ...intent }` as session data, so a client
   * `data.id` can survive if intent creation failed. Only authorise an intent
   * that this provider created for this very session (metadata.session_id is
   * set server-side; the payment module passes the session id as
   * idempotency_key). The intent's amount is then this session's amount.
   */
  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const result = await super.authorizePayment(input)
    const intent = result.data as { metadata?: Record<string, unknown> } | undefined
    const sessionId = input.context?.idempotency_key
    if (!sessionId || intent?.metadata?.session_id !== sessionId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Stripe payment does not belong to this payment session"
      )
    }
    return result
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const { data, amount, currency_code, context } = input
    const amountPence = getSmallestUnit(amount, currency_code)
    const klarna = this.klarna_(
      amountPence,
      this.klarnaMinFor_(context as Record<string, unknown> | undefined, data)
    )
    if (isPresent(amount) && data?.amount === amountPence) {
      const same = this.status_(data)
      return { ...same, data: { ...same.data, ...klarna } }
    }

    const excluded = this.excludedTypes_(klarna)
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
      const updated = this.status_(intent)
      return { ...updated, data: { ...updated.data, ...klarna } }
    } catch (e) {
      throw this.buildError("An error occurred in updatePayment", e as Error)
    }
  }
}

export default TechNestStripeService
