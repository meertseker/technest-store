/**
 * Payment step helpers (owner: E2). Pure functions only, so they run in the
 * server component, the client component and vitest alike.
 * Contract: docs/contracts/payments.md, ADR 0002.
 *
 * Money: Medusa amounts are major units (13.47); our values are integer pence
 * named `*_pence`. Convert only with `toPence` / `formatPence` here.
 */

export const STRIPE_PROVIDER_ID = "pp_stripe_stripe"
/** Medusa's manual provider. Dev/CI only: it completes orders without taking payment. */
export const MANUAL_PROVIDER_ID = "pp_system_default"

/** 13.47 -> 1347. Rounds away float noise from Medusa's decimals. */
export function toPence(major: number | null | undefined): number {
  if (typeof major !== "number" || !Number.isFinite(major)) return 0
  return Math.round(major * 100)
}

/** 3000 -> "£30", 2999 -> "£29.99" (whole pounds without ".00", for short copy) */
export function formatPence(pence: number): string {
  const pounds = pence / 100
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number.isInteger(pounds) ? 0 : 2,
  }).format(pounds)
}

/** 1347 -> "£13.47" (always two decimals, for totals) */
export function formatPenceExact(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100)
}

// ---------------------------------------------------------------------------
// Which payment path the step shows

export type PaymentMode = "stripe" | "manual" | "unavailable"

/**
 * - `stripe`: the backend offers `pp_stripe_stripe` and we have a publishable key.
 * - `manual`: dev/CI only (NODE_ENV !== "production") and the backend offers the
 *   manual provider. Never in a production build, whatever the providers say.
 * - `unavailable`: anything else (e.g. production without a key): no order can be placed.
 */
export function resolvePaymentMode({
  nodeEnv,
  stripeKey,
  providerIds,
}: {
  nodeEnv: string | undefined
  stripeKey: string | undefined
  providerIds: readonly string[]
}): PaymentMode {
  const key = stripeKey?.trim() ?? ""
  if (key.startsWith("pk_") && providerIds.includes(STRIPE_PROVIDER_ID)) return "stripe"
  if (nodeEnv !== "production" && providerIds.includes(MANUAL_PROVIDER_ID)) return "manual"
  return "unavailable"
}

export function providerForMode(mode: PaymentMode): string | null {
  if (mode === "stripe") return STRIPE_PROVIDER_ID
  if (mode === "manual") return MANUAL_PROVIDER_ID
  return null
}

// ---------------------------------------------------------------------------
// Payment session: reuse or (re)initiate

export type SessionLike = {
  provider_id: string
  status?: string | null
  amount?: number | null
  data?: Record<string, unknown> | null
}

export type CollectionLike = {
  amount?: number | null
  payment_sessions?: readonly SessionLike[] | null
} | null | undefined

const DEAD_STATUSES = new Set(["canceled", "error"])

export function findSession(collection: CollectionLike, providerId: string): SessionLike | null {
  return collection?.payment_sessions?.find((s) => s.provider_id === providerId) ?? null
}

/**
 * Medusa deletes the payment sessions when the cart total changes (items,
 * delivery option, promo), so a missing session or one for another amount
 * means "initiate again". The Klarna flag is re-evaluated on each initiation.
 */
export function sessionDecision({
  collection,
  providerId,
  cartTotal,
}: {
  collection: CollectionLike
  providerId: string
  /** Medusa major units */
  cartTotal: number | null | undefined
}): "reuse" | "create" {
  if (!collection) return "create"
  const totalPence = toPence(cartTotal)
  if (toPence(collection.amount) !== totalPence) return "create"
  const session = findSession(collection, providerId)
  if (!session || DEAD_STATUSES.has(session.status ?? "")) return "create"
  if (session.amount != null && toPence(session.amount) !== totalPence) return "create"
  if (providerId === STRIPE_PROVIDER_ID && typeof session.data?.client_secret !== "string") return "create"
  return "reuse"
}

/**
 * What the browser gets from the Stripe session: only the client secret and the
 * Klarna decision. The rest of the PaymentIntent stays on the server.
 */
export type StripeSessionView = {
  client_secret: string
  klarna_available: boolean
  klarna_min_basket_pence: number | null
}

export function toStripeSessionView(session: SessionLike | null): StripeSessionView | null {
  const d = session?.data
  if (!d || typeof d.client_secret !== "string" || !d.client_secret) return null
  const min = d.klarna_min_basket_pence
  return {
    client_secret: d.client_secret,
    klarna_available: d.klarna_available === true,
    klarna_min_basket_pence: Number.isInteger(min) && (min as number) >= 0 ? (min as number) : null,
  }
}

// ---------------------------------------------------------------------------
// Klarna copy

/**
 * Payment step: the session flag is authoritative (never our own totals).
 * - available: show the Klarna line
 * - not available with a known minimum: "Klarna is available on orders over £30"
 * - otherwise nothing
 */
export function klarnaPaymentNote(view: Pick<StripeSessionView, "klarna_available" | "klarna_min_basket_pence"> | null):
  | { kind: "available"; text: string }
  | { kind: "below-minimum"; text: string }
  | null {
  if (!view) return null
  if (view.klarna_available) {
    return { kind: "available", text: "Pay in 3 interest-free instalments with Klarna. Choose Klarna below." }
  }
  if (view.klarna_min_basket_pence != null && view.klarna_min_basket_pence > 0) {
    return { kind: "below-minimum", text: `Klarna is available on orders over ${formatPence(view.klarna_min_basket_pence)}` }
  }
  return null
}

/**
 * Basket (before checkout): display-only hint from GET /store/technest-settings
 * against the basket total in pence. The session flag decides at checkout.
 */
export function klarnaBasketHint(totalPence: number, minPence: number | null | undefined): string | null {
  if (minPence == null || !Number.isInteger(minPence) || minPence <= 0) return null
  if (totalPence >= minPence) return "Pay in 3 with Klarna available at checkout"
  return `Klarna is available on orders over ${formatPence(minPence)}`
}

// ---------------------------------------------------------------------------
// Stripe confirmPayment outcome

/** The parts of Stripe's result we read. Never log the rest (it can hold PII). */
export type ConfirmResultLike = {
  error?: {
    type?: string
    code?: string
    decline_code?: string
    message?: string
    payment_intent?: { status?: string } | null
  }
  paymentIntent?: { status?: string } | null
}

/** Authorised (`capture: false` -> requires_capture); succeeded only if capture changes later */
const AUTHORISED = new Set(["requires_capture", "succeeded"])

export type ConfirmOutcome =
  | { kind: "authorised" }
  | { kind: "error"; message: string; focus: "payment" | "button" }

export const NETWORK_ERROR =
  "We couldn't reach the payment service. Check your internet connection and try again. You haven't been charged."
const GENERIC_ERROR = "Something went wrong with the payment. You haven't been charged. Please try again."
const AUTH_FAILED =
  "Your bank couldn't confirm the payment. Try again, or use another card or payment method."
const DECLINED = "Your card was declined. Try another card or payment method."

export function classifyConfirmResult(result: ConfirmResultLike): ConfirmOutcome {
  const { error, paymentIntent } = result
  if (!error) {
    if (paymentIntent?.status && AUTHORISED.has(paymentIntent.status)) return { kind: "authorised" }
    if (paymentIntent?.status === "processing") {
      return {
        kind: "error",
        focus: "button",
        message: "Your payment is still processing. Wait a moment, then press Place order again.",
      }
    }
    return { kind: "error", message: GENERIC_ERROR, focus: "button" }
  }
  // Already authorised (e.g. the order step failed and the shopper retries)
  if (error.payment_intent?.status && AUTHORISED.has(error.payment_intent.status)) return { kind: "authorised" }

  switch (error.type) {
    case "validation_error":
      return { kind: "error", focus: "payment", message: "Check your payment details and try again." }
    case "card_error":
      if (error.code === "payment_intent_authentication_failure") {
        return { kind: "error", focus: "payment", message: AUTH_FAILED }
      }
      return {
        kind: "error",
        focus: "payment",
        // Stripe's card_error messages are written for shoppers ("Your card has insufficient funds.")
        message: error.message ? `${ensureStop(error.message)} Try another card or payment method.` : DECLINED,
      }
    case "invalid_request_error":
      if (error.code === "payment_intent_authentication_failure") {
        return { kind: "error", focus: "payment", message: AUTH_FAILED }
      }
      return { kind: "error", focus: "button", message: GENERIC_ERROR }
    case "api_connection_error":
      return { kind: "error", focus: "button", message: NETWORK_ERROR }
    default:
      return { kind: "error", focus: "button", message: GENERIC_ERROR }
  }
}

function ensureStop(s: string) {
  const t = s.trim()
  return /[.!?]$/.test(t) ? t : `${t}.`
}

/** `?payment_error=` codes set by /api/payment-return after an off-site step (3DS, Klarna) */
export function returnErrorMessage(code: string | null | undefined): string | null {
  switch (code) {
    case "declined":
      return "Your payment wasn't completed. You haven't been charged. Try again, or use another card or payment method."
    case "order_failed":
      return "Your payment was authorised but we couldn't place your order. Please press Place order again, or call the shop."
    case "payment_failed":
      return "We couldn't confirm your payment. You haven't been charged. Please try again."
    default:
      return null
  }
}

export const ORDER_FAILED =
  "Your payment was authorised but we couldn't place your order. Please try again. If it keeps happening, call the shop. We only take money for orders we place."
export const SESSION_FAILED =
  "We couldn't load the secure payment form. Check your connection and try again."
