import { describe, expect, it } from "vitest"
import {
  MANUAL_PROVIDER_ID,
  NETWORK_ERROR,
  STRIPE_PROVIDER_ID,
  classifyConfirmResult,
  formatPence,
  formatPenceExact,
  klarnaBasketHint,
  klarnaPaymentNote,
  providerForMode,
  resolvePaymentMode,
  returnErrorMessage,
  sessionDecision,
  toPence,
  toStripeSessionView,
} from "./helpers"

describe("money at the boundary", () => {
  it("converts Medusa major units to pence without float noise", () => {
    expect(toPence(13.47)).toBe(1347)
    expect(toPence(0.1 + 0.2)).toBe(30)
    expect(toPence(29.99)).toBe(2999)
    expect(toPence(null)).toBe(0)
    expect(toPence(Number.NaN)).toBe(0)
  })

  it("formats pence as pounds", () => {
    expect(formatPence(3000)).toBe("£30")
    expect(formatPence(2999)).toBe("£29.99")
    expect(formatPence(5)).toBe("£0.05")
    expect(formatPenceExact(3000)).toBe("£30.00")
    expect(formatPenceExact(1347)).toBe("£13.47")
  })
})

describe("resolvePaymentMode", () => {
  const both = [MANUAL_PROVIDER_ID, STRIPE_PROVIDER_ID]
  it("uses Stripe when the key and the provider are there", () => {
    expect(resolvePaymentMode({ nodeEnv: "production", stripeKey: "pk_test_x", providerIds: both })).toBe("stripe")
    expect(resolvePaymentMode({ nodeEnv: "development", stripeKey: "pk_test_x", providerIds: [STRIPE_PROVIDER_ID] })).toBe("stripe")
  })

  it("falls back to the manual provider only outside production", () => {
    expect(resolvePaymentMode({ nodeEnv: "development", stripeKey: "", providerIds: both })).toBe("manual")
    expect(resolvePaymentMode({ nodeEnv: "test", stripeKey: undefined, providerIds: [MANUAL_PROVIDER_ID] })).toBe("manual")
    // key set but the backend has no Stripe provider (dev backend without STRIPE_API_KEY)
    expect(resolvePaymentMode({ nodeEnv: "development", stripeKey: "pk_test_x", providerIds: [MANUAL_PROVIDER_ID] })).toBe("manual")
  })

  it("never offers the manual provider in production", () => {
    expect(resolvePaymentMode({ nodeEnv: "production", stripeKey: "", providerIds: both })).toBe("unavailable")
    expect(resolvePaymentMode({ nodeEnv: "production", stripeKey: "pk_live_x", providerIds: [MANUAL_PROVIDER_ID] })).toBe("unavailable")
  })

  it("ignores values that aren't publishable keys", () => {
    expect(resolvePaymentMode({ nodeEnv: "production", stripeKey: "sk_test_x", providerIds: both })).toBe("unavailable")
    expect(resolvePaymentMode({ nodeEnv: "development", stripeKey: "  ", providerIds: [] })).toBe("unavailable")
  })

  it("maps modes to providers", () => {
    expect(providerForMode("stripe")).toBe(STRIPE_PROVIDER_ID)
    expect(providerForMode("manual")).toBe(MANUAL_PROVIDER_ID)
    expect(providerForMode("unavailable")).toBeNull()
  })
})

describe("sessionDecision (re-initiate when the total changes)", () => {
  const stripeSession = (amount = 23.47, extra: Record<string, unknown> = {}) => ({
    provider_id: STRIPE_PROVIDER_ID,
    status: "pending",
    amount,
    data: { client_secret: "pi_1_secret_2", ...extra },
  })

  it("creates when there is no payment collection or session yet", () => {
    expect(sessionDecision({ collection: null, providerId: STRIPE_PROVIDER_ID, cartTotal: 23.47 })).toBe("create")
    expect(
      sessionDecision({ collection: { amount: 23.47, payment_sessions: [] }, providerId: STRIPE_PROVIDER_ID, cartTotal: 23.47 })
    ).toBe("create")
  })

  it("reuses a live session for the same total", () => {
    expect(
      sessionDecision({
        collection: { amount: 23.47, payment_sessions: [stripeSession()] },
        providerId: STRIPE_PROVIDER_ID,
        cartTotal: 23.47,
      })
    ).toBe("reuse")
  })

  it("creates again when the delivery choice changed the total", () => {
    // Collect (free) -> Standard (+£3.49): the collection still has the old amount
    expect(
      sessionDecision({
        collection: { amount: 20, payment_sessions: [stripeSession(20)] },
        providerId: STRIPE_PROVIDER_ID,
        cartTotal: 23.49,
      })
    ).toBe("create")
    // collection refreshed but a stale session is left over
    expect(
      sessionDecision({
        collection: { amount: 23.49, payment_sessions: [stripeSession(20)] },
        providerId: STRIPE_PROVIDER_ID,
        cartTotal: 23.49,
      })
    ).toBe("create")
  })

  it("tolerates float noise between the cart and the collection", () => {
    expect(
      sessionDecision({
        collection: { amount: 0.1 + 0.2, payment_sessions: [stripeSession(0.3)] },
        providerId: STRIPE_PROVIDER_ID,
        cartTotal: 0.3,
      })
    ).toBe("reuse")
  })

  it("creates when the session is dead, for another provider, or has no client secret", () => {
    const base = { amount: 10, cartTotal: 10 }
    expect(
      sessionDecision({
        collection: { amount: base.amount, payment_sessions: [{ ...stripeSession(10), status: "canceled" }] },
        providerId: STRIPE_PROVIDER_ID,
        cartTotal: base.cartTotal,
      })
    ).toBe("create")
    expect(
      sessionDecision({
        collection: { amount: 10, payment_sessions: [{ provider_id: MANUAL_PROVIDER_ID, status: "pending", amount: 10, data: {} }] },
        providerId: STRIPE_PROVIDER_ID,
        cartTotal: 10,
      })
    ).toBe("create")
    expect(
      sessionDecision({
        collection: { amount: 10, payment_sessions: [{ ...stripeSession(10), data: {} }] },
        providerId: STRIPE_PROVIDER_ID,
        cartTotal: 10,
      })
    ).toBe("create")
  })

  it("the manual provider needs no client secret", () => {
    expect(
      sessionDecision({
        collection: { amount: 10, payment_sessions: [{ provider_id: MANUAL_PROVIDER_ID, status: "pending", amount: 10, data: {} }] },
        providerId: MANUAL_PROVIDER_ID,
        cartTotal: 10,
      })
    ).toBe("reuse")
  })
})

describe("toStripeSessionView", () => {
  it("keeps only the client secret and the Klarna decision", () => {
    const view = toStripeSessionView({
      provider_id: STRIPE_PROVIDER_ID,
      data: {
        id: "pi_1",
        client_secret: "pi_1_secret_2",
        klarna_available: true,
        klarna_min_basket_pence: 3000,
        customer: "cus_1",
        receipt_email: "x@example.com",
      },
    })
    expect(view).toEqual({ client_secret: "pi_1_secret_2", klarna_available: true, klarna_min_basket_pence: 3000 })
  })

  it("treats a missing or odd flag as not available", () => {
    expect(
      toStripeSessionView({ provider_id: STRIPE_PROVIDER_ID, data: { client_secret: "s", klarna_available: "yes", klarna_min_basket_pence: 29.5 } })
    ).toEqual({ client_secret: "s", klarna_available: false, klarna_min_basket_pence: null })
    expect(toStripeSessionView({ provider_id: STRIPE_PROVIDER_ID, data: {} })).toBeNull()
    expect(toStripeSessionView(null)).toBeNull()
  })
})

describe("Klarna visibility", () => {
  it("payment step: shows Klarna only when the session says so", () => {
    expect(klarnaPaymentNote({ klarna_available: true, klarna_min_basket_pence: 3000 })?.kind).toBe("available")
    expect(klarnaPaymentNote({ klarna_available: false, klarna_min_basket_pence: 3000 })).toEqual({
      kind: "below-minimum",
      text: "Klarna is available on orders over £30",
    })
    expect(klarnaPaymentNote({ klarna_available: false, klarna_min_basket_pence: 2550 })?.text).toBe(
      "Klarna is available on orders over £25.50"
    )
    expect(klarnaPaymentNote({ klarna_available: false, klarna_min_basket_pence: null })).toBeNull()
    expect(klarnaPaymentNote(null)).toBeNull()
  })

  it("basket: hint from the settings minimum", () => {
    expect(klarnaBasketHint(2999, 3000)).toBe("Klarna is available on orders over £30")
    expect(klarnaBasketHint(3000, 3000)).toBe("Pay in 3 with Klarna available at checkout")
    expect(klarnaBasketHint(5000, null)).toBeNull()
    expect(klarnaBasketHint(5000, 0)).toBeNull()
  })
})

describe("classifyConfirmResult", () => {
  it("authorised = requires_capture (capture: false)", () => {
    expect(classifyConfirmResult({ paymentIntent: { status: "requires_capture" } })).toEqual({ kind: "authorised" })
    expect(classifyConfirmResult({ paymentIntent: { status: "succeeded" } })).toEqual({ kind: "authorised" })
  })

  it("a retry after the order step failed is still authorised", () => {
    expect(
      classifyConfirmResult({
        error: { type: "invalid_request_error", code: "payment_intent_unexpected_state", payment_intent: { status: "requires_capture" } },
      })
    ).toEqual({ kind: "authorised" })
  })

  it("declines use Stripe's shopper message and point at the payment form", () => {
    const out = classifyConfirmResult({ error: { type: "card_error", code: "card_declined", message: "Your card has insufficient funds." } })
    expect(out).toEqual({
      kind: "error",
      focus: "payment",
      message: "Your card has insufficient funds. Try another card or payment method.",
    })
    expect(classifyConfirmResult({ error: { type: "card_error" } })).toMatchObject({
      message: "Your card was declined. Try another card or payment method.",
    })
  })

  it("3DS failure", () => {
    expect(
      classifyConfirmResult({ error: { type: "card_error", code: "payment_intent_authentication_failure", message: "x" } })
    ).toMatchObject({ focus: "payment", message: expect.stringContaining("Your bank couldn't confirm") })
  })

  it("validation and network errors", () => {
    expect(classifyConfirmResult({ error: { type: "validation_error", message: "Incomplete" } })).toMatchObject({
      focus: "payment",
      message: "Check your payment details and try again.",
    })
    expect(classifyConfirmResult({ error: { type: "api_connection_error" } })).toEqual({
      kind: "error",
      focus: "button",
      message: NETWORK_ERROR,
    })
  })

  it("anything else is not authorised", () => {
    expect(classifyConfirmResult({ paymentIntent: { status: "requires_payment_method" } }).kind).toBe("error")
    expect(classifyConfirmResult({ paymentIntent: { status: "processing" } })).toMatchObject({
      message: expect.stringContaining("still processing"),
    })
    expect(classifyConfirmResult({}).kind).toBe("error")
    expect(classifyConfirmResult({ error: { type: "api_error" } }).kind).toBe("error")
  })
})

describe("returnErrorMessage", () => {
  it("maps /api/payment-return codes, ignores anything else", () => {
    expect(returnErrorMessage("declined")).toContain("You haven't been charged")
    expect(returnErrorMessage("order_failed")).toContain("couldn't place your order")
    expect(returnErrorMessage("payment_failed")).toContain("couldn't confirm your payment")
    expect(returnErrorMessage("<script>")).toBeNull()
    expect(returnErrorMessage(null)).toBeNull()
  })
})
