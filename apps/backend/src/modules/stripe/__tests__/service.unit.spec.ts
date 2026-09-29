import TechNestStripeService from "../service"

// Stripe's API is the network boundary: the fake records the params we send.
function makeService(options: Record<string, unknown> = {}) {
  const service = new TechNestStripeService({ logger: console } as any, {
    apiKey: "sk_test_unit",
    webhookSecret: "whsec_unit",
    capture: false,
    automaticPaymentMethods: true,
    klarnaMinBasketPence: 3000,
    ...options,
  } as any)
  const create = jest.fn(async (params: any) => ({
    id: "pi_123",
    object: "payment_intent",
    status: "requires_payment_method",
    amount: params.amount,
    currency: params.currency,
    metadata: params.metadata,
  }))
  const update = jest.fn(async (id: string, params: any) => ({
    id,
    object: "payment_intent",
    status: "requires_payment_method",
    amount: params.amount ?? 1000,
    currency: "gbp",
  }))
  ;(service as any).stripe_ = { paymentIntents: { create, update } }
  return { service, create, update }
}

describe("TechNestStripeService", () => {
  it("keeps Medusa's provider id pp_stripe_stripe (identifier 'stripe')", () => {
    expect(TechNestStripeService.identifier).toBe("stripe")
  })

  describe("initiatePayment", () => {
    it("ignores every client-supplied PaymentIntent parameter except the session id", async () => {
      const { service, create } = makeService()

      await service.initiatePayment({
        amount: 50,
        currency_code: "gbp",
        data: {
          session_id: "payses_1",
          capture_method: "automatic",
          payment_method_types: ["klarna"],
          payment_method_configuration: "pmc_evil",
          confirm: true,
          off_session: true,
          payment_method: "pm_evil",
          return_url: "https://evil.example",
          setup_future_usage: "off_session",
          metadata: { injected: "yes" },
        },
        context: {},
      } as any)

      const params = create.mock.calls[0][0]
      expect(params.capture_method).toBe("manual")
      expect(params.automatic_payment_methods).toEqual({ enabled: true })
      expect(params.metadata).toEqual({ session_id: "payses_1" })
      for (const key of [
        "payment_method_types",
        "payment_method_configuration",
        "confirm",
        "off_session",
        "payment_method",
        "return_url",
        "setup_future_usage",
      ]) {
        expect(params[key]).toBeUndefined()
      }
      expect(params.amount).toBe(5000)
      expect(params.currency).toBe("gbp")
    })

    it("excludes Klarna when the amount is below the minimum basket", async () => {
      const { service, create } = makeService()

      await service.initiatePayment({
        amount: 29.99,
        currency_code: "gbp",
        data: { session_id: "payses_1" },
        context: {},
      } as any)

      expect(create.mock.calls[0][0].excluded_payment_method_types).toEqual(["klarna"])
    })

    it("allows Klarna at exactly the minimum basket", async () => {
      const { service, create } = makeService()

      await service.initiatePayment({
        amount: 30,
        currency_code: "gbp",
        data: { session_id: "payses_1" },
        context: {},
      } as any)

      expect(create.mock.calls[0][0].excluded_payment_method_types).toBeUndefined()
    })
  })

  describe("updatePayment", () => {
    it("re-evaluates Klarna when the basket crosses the minimum upwards", async () => {
      const { service, update } = makeService()

      await service.updatePayment({
        amount: 35,
        currency_code: "gbp",
        data: { id: "pi_123", amount: 2500 },
        context: {},
      } as any)

      expect(update).toHaveBeenCalledWith(
        "pi_123",
        expect.objectContaining({ amount: 3500, excluded_payment_method_types: "" }),
        expect.anything()
      )
    })

    it("re-evaluates Klarna when the basket drops below the minimum", async () => {
      const { service, update } = makeService()

      await service.updatePayment({
        amount: 12.5,
        currency_code: "gbp",
        data: { id: "pi_123", amount: 4000 },
        context: {},
      } as any)

      expect(update).toHaveBeenCalledWith(
        "pi_123",
        expect.objectContaining({ amount: 1250, excluded_payment_method_types: ["klarna"] }),
        expect.anything()
      )
    })

    it("makes no Stripe call when the amount is unchanged", async () => {
      const { service, update } = makeService()

      await service.updatePayment({
        amount: 25,
        currency_code: "gbp",
        data: { id: "pi_123", amount: 2500 },
        context: {},
      } as any)

      expect(update).not.toHaveBeenCalled()
    })
  })
})
