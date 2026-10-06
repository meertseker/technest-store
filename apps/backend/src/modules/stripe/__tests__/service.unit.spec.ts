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
  const retrieve = jest.fn(async (id: string) => ({
    id,
    object: "payment_intent",
    status: "requires_capture",
    amount: 5000,
    currency: "gbp",
    metadata: { session_id: "payses_1" },
  }))
  ;(service as any).stripe_ = { paymentIntents: { create, update, retrieve } }
  return { service, create, update, retrieve }
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

  describe("Klarna minimum from the settings module (session context)", () => {
    it("uses the context minimum over the option and flags the session data", async () => {
      const { service, create } = makeService({ klarnaMinBasketPence: 3000 })

      const below = await service.initiatePayment({
        amount: 45,
        currency_code: "gbp",
        data: { session_id: "payses_1" },
        context: { technest_klarna_min_basket_pence: 5000 },
      } as any)
      const above = await service.initiatePayment({
        amount: 20,
        currency_code: "gbp",
        data: { session_id: "payses_2" },
        context: { technest_klarna_min_basket_pence: 1500 },
      } as any)

      expect(create.mock.calls[0][0].excluded_payment_method_types).toEqual(["klarna"])
      expect(below.data).toMatchObject({ id: "pi_123", klarna_available: false, klarna_min_basket_pence: 5000 })
      expect(create.mock.calls[1][0].excluded_payment_method_types).toBeUndefined()
      expect(above.data).toMatchObject({ klarna_available: true, klarna_min_basket_pence: 1500 })
    })

    it("falls back to the option when the context value is missing or invalid", async () => {
      const { service } = makeService({ klarnaMinBasketPence: 3000 })

      for (const bad of [undefined, "0", -1, 12.5, null]) {
        const res = await service.initiatePayment({
          amount: 29.99,
          currency_code: "gbp",
          data: { session_id: "payses_1" },
          context: { technest_klarna_min_basket_pence: bad },
        } as any)
        expect(res.data).toMatchObject({ klarna_available: false, klarna_min_basket_pence: 3000 })
      }
    })

    it("never lets client data set the minimum", async () => {
      const { service, create } = makeService({ klarnaMinBasketPence: 3000 })

      const res = await service.initiatePayment({
        amount: 5,
        currency_code: "gbp",
        data: { session_id: "payses_1", klarna_min_basket_pence: 0, klarna_available: true },
        context: {},
      } as any)

      expect(create.mock.calls[0][0].excluded_payment_method_types).toEqual(["klarna"])
      expect(res.data).toMatchObject({ klarna_available: false, klarna_min_basket_pence: 3000 })
    })

    it("updatePayment keeps the minimum stored on the session", async () => {
      const { service, update } = makeService({ klarnaMinBasketPence: 3000 })

      const res = await service.updatePayment({
        amount: 45,
        currency_code: "gbp",
        data: { id: "pi_123", amount: 2500, klarna_min_basket_pence: 5000 },
        context: {},
      } as any)

      expect(update).toHaveBeenCalledWith(
        "pi_123",
        expect.objectContaining({ amount: 4500, excluded_payment_method_types: ["klarna"] }),
        expect.anything()
      )
      expect(res.data).toMatchObject({ klarna_available: false, klarna_min_basket_pence: 5000 })
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

  describe("authorizePayment (security review: stale client data.id)", () => {
    it("authorises an intent created for this payment session", async () => {
      const { service } = makeService()

      const result = await service.authorizePayment({
        data: { id: "pi_123", amount: 5000, currency: "gbp" },
        context: { idempotency_key: "payses_1" },
      } as any)

      expect(result.status).toBe("authorized")
    })

    it("refuses an intent that belongs to another payment session", async () => {
      const { service } = makeService()

      await expect(
        service.authorizePayment({
          data: { id: "pi_from_other_order" },
          context: { idempotency_key: "payses_2" },
        } as any)
      ).rejects.toThrow("does not belong to this payment session")
    })

    it("refuses when the payment session id is unknown", async () => {
      const { service } = makeService()

      await expect(
        service.authorizePayment({ data: { id: "pi_123" }, context: {} } as any)
      ).rejects.toThrow("does not belong to this payment session")
    })
  })

  // Medusa books the session's amount; Stripe captures the intent's. They must be the same figure.
  describe("authorizePayment (amount check)", () => {
    const authorise = (service: any, data: Record<string, unknown>) =>
      service.authorizePayment({ data: { id: "pi_123", ...data }, context: { idempotency_key: "payses_1" } })

    it("refuses an intent whose amount differs from the session's", async () => {
      const { service } = makeService()

      await expect(authorise(service, { amount: 4999, currency: "gbp" })).rejects.toThrow(
        "amount does not match"
      )
    })

    it("refuses an intent in another currency", async () => {
      const { service } = makeService()

      await expect(authorise(service, { amount: 5000, currency: "eur" })).rejects.toThrow("amount does not match")
    })

    it("refuses an authorised intent that can't be captured in full", async () => {
      const { service, retrieve } = makeService()
      retrieve.mockResolvedValueOnce({
        id: "pi_123",
        object: "payment_intent",
        status: "requires_capture",
        amount: 5000,
        amount_capturable: 3000,
        currency: "gbp",
        metadata: { session_id: "payses_1" },
      } as any)

      await expect(authorise(service, { amount: 5000, currency: "gbp" })).rejects.toThrow("amount does not match")
    })

    it("accepts a matching intent, with or without amount_capturable in the answer", async () => {
      const { service, retrieve } = makeService()
      expect((await authorise(service, { amount: 5000, currency: "GBP" })).status).toBe("authorized")

      retrieve.mockResolvedValueOnce({
        id: "pi_123",
        object: "payment_intent",
        status: "requires_capture",
        amount: 5000,
        amount_capturable: 5000,
        currency: "gbp",
        metadata: { session_id: "payses_1" },
      } as any)
      expect((await authorise(service, { amount: 5000, currency: "gbp" })).status).toBe("authorized")
    })
  })

  describe("Stripe client", () => {
    // Cart completion holds the cart's lock for 120 s; Stripe's default is 80 s per try plus a retry.
    it("gives up on a slow Stripe call well inside the cart lock", () => {
      const service = new TechNestStripeService({ logger: console } as any, {
        apiKey: "sk_test_unit",
        webhookSecret: "whsec_unit",
        capture: false,
      } as any)
      const client = (service as any).stripe_

      expect(client.getApiField("timeout")).toBe(20_000)
      expect(client.getMaxNetworkRetries()).toBe(1)
    })
  })

  // Medusa sends the payment id as the idempotency key of every cancel. Stripe replays the saved
  // answer for a key, errors included, so a retry with the same key could never succeed.
  describe("cancelPayment", () => {
    it("sends no idempotency key, so a retry after a failed release is a fresh request", async () => {
      const { service } = makeService()
      const cancel = jest.fn(async (id: string) => ({ id, object: "payment_intent", status: "canceled" }))
      ;(service as any).stripe_.paymentIntents.cancel = cancel

      const result = await service.cancelPayment({
        data: { id: "pi_123" },
        context: { idempotency_key: "pay_1" },
      } as any)

      expect(cancel).toHaveBeenCalledWith("pi_123", { idempotencyKey: undefined })
      expect((result.data as any).status).toBe("canceled")
    })
  })

  // An event is handled seconds after Stripe sent it. By then the session may be gone (the basket
  // changed, or the order was refused and the hold released), which cancels the intent at Stripe.
  // Medusa then can't find the session's cart and picks another one, so a "paid" event for an
  // intent that is cancelled by now must not be acted on.
  describe("getWebhookActionAndData", () => {
    const event = (type: string) => ({
      type,
      data: {
        object: {
          id: "pi_123",
          amount: 1148,
          amount_capturable: 1148,
          amount_received: 1148,
          currency: "gbp",
          metadata: { session_id: "payses_1" },
        },
      },
    })
    function withEvent(type: string, statusNow: string | Error) {
      const made = makeService()
      const retrieve = jest.fn(async () => {
        if (statusNow instanceof Error) throw statusNow
        return { id: "pi_123", object: "payment_intent", status: statusNow }
      })
      ;(made.service as any).stripe_.paymentIntents.retrieve = retrieve
      ;(made.service as any).stripe_.webhooks = { constructEvent: () => event(type) }
      const payload = { data: {}, rawData: "{}", headers: { "stripe-signature": "t=1,v1=x" } } as any
      return { run: () => made.service.getWebhookActionAndData(payload), retrieve }
    }

    it.each(["payment_intent.amount_capturable_updated", "payment_intent.succeeded"])(
      "ignores %s when the intent has been cancelled since",
      async (type) => {
        const { run } = withEvent(type, "canceled")
        expect(await run()).toEqual({ action: "not_supported" })
      }
    )

    it("passes an authorised event on when the intent is still authorised", async () => {
      const { run } = withEvent("payment_intent.amount_capturable_updated", "requires_capture")
      expect(await run()).toEqual({ action: "authorized", data: { session_id: "payses_1", amount: 11.48 } })
    })

    it("passes the event on when Stripe can't be asked, so a paid order is never dropped", async () => {
      const { run } = withEvent("payment_intent.succeeded", new Error("network"))
      expect(await run()).toMatchObject({ action: "captured", data: { session_id: "payses_1" } })
    })

    it("asks Stripe nothing for events that never place an order", async () => {
      const { run, retrieve } = withEvent("payment_intent.payment_failed", "requires_payment_method")
      expect(await run()).toMatchObject({ action: "failed" })
      expect(retrieve).not.toHaveBeenCalled()
    })
  })
})
