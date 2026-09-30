import TechNestStripeService from "../service"

// Capture, cancel and refund are Medusa's stock Stripe code (ADR 0002). These
// tests pin the Stripe calls our subclass makes for them, at the network boundary.
function makeService() {
  const service = new TechNestStripeService({ logger: console } as any, {
    apiKey: "sk_test_unit",
    webhookSecret: "whsec_unit",
    capture: false,
    automaticPaymentMethods: true,
    klarnaMinBasketPence: 3000,
  } as any)
  const capture = jest.fn(async (id: string) => ({ id, object: "payment_intent", status: "succeeded" }))
  const cancel = jest.fn(async (id: string) => ({ id, object: "payment_intent", status: "canceled" }))
  const refundsCreate = jest.fn(async (params: any) => ({ id: "re_1", ...params }))
  ;(service as any).stripe_ = {
    paymentIntents: { capture, cancel },
    refunds: { create: refundsCreate },
  }
  return { service, capture, cancel, refundsCreate }
}

const data = { id: "pi_123", currency: "gbp" }

describe("TechNestStripeService capture / cancel / refund", () => {
  it("captures the whole intent with the capture's idempotency key", async () => {
    const { service, capture } = makeService()

    const res = await service.capturePayment({ data, context: { idempotency_key: "capt_1" } } as any)

    expect(capture).toHaveBeenCalledWith("pi_123", { idempotencyKey: "capt_1" })
    expect(res.data).toMatchObject({ status: "succeeded" })
  })

  it("cancels the intent, releasing the authorisation", async () => {
    const { service, cancel } = makeService()

    await service.cancelPayment({ data, context: { idempotency_key: "pay_1" } } as any)

    expect(cancel).toHaveBeenCalledWith("pi_123", { idempotencyKey: "pay_1" })
  })

  it("refunds partial and full amounts in pence (Medusa amounts are in pounds)", async () => {
    const { service, refundsCreate } = makeService()

    await service.refundPayment({ amount: 5, data, context: { idempotency_key: "ref_1" } } as any)
    await service.refundPayment({ amount: 8.47, data, context: { idempotency_key: "ref_2" } } as any)

    expect(refundsCreate).toHaveBeenNthCalledWith(
      1,
      { amount: 500, payment_intent: "pi_123" },
      { idempotencyKey: "ref_1" }
    )
    expect(refundsCreate).toHaveBeenNthCalledWith(
      2,
      { amount: 847, payment_intent: "pi_123" },
      { idempotencyKey: "ref_2" }
    )
  })

  it("treats an already refunded charge as refunded instead of failing", async () => {
    const { service, refundsCreate } = makeService()
    refundsCreate.mockRejectedValueOnce(Object.assign(new Error("already"), { code: "charge_already_refunded" }))

    await expect(
      service.refundPayment({ amount: 5, data, context: {} } as any)
    ).resolves.toEqual({ data })
  })
})
