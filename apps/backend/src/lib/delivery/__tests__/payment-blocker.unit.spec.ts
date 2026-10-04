import { paymentBlocker } from ".."

const captured = (amount: number, refunds: number[] = []) => ({
  captured_at: "2026-10-04T10:00:00Z",
  canceled_at: null,
  captures: [{ amount }],
  refunds: refunds.map((r) => ({ amount: r })),
})
const order = (total: number, payments: unknown[]) =>
  ({ id: "order_1", total, payment_collections: payments.length ? [{ payments }] : [] }) as any

describe("paymentBlocker", () => {
  it("lets a captured order ship", () => {
    expect(paymentBlocker(order(13.47, [captured(13.47)]))).toBeNull()
  })

  it("refuses an order whose payment is only authorised", () => {
    expect(paymentBlocker(order(13.47, [{ captured_at: null, canceled_at: null }]))).toMatch(/hasn't been taken/)
  })

  it("refuses an order with a total and no payment at all", () => {
    expect(paymentBlocker(order(13.47, []))).toMatch(/hasn't been taken/)
  })

  // A 100% promotion with free delivery: Medusa creates no payment for a zero total.
  it("lets an order with nothing to pay ship", () => {
    expect(paymentBlocker(order(0, []))).toBeNull()
  })

  // 0.02 + 13.45 is 13.469999999999999 in floating point.
  it("refuses an order refunded in full across several refunds", () => {
    expect(paymentBlocker(order(13.47, [captured(13.47, [0.02, 13.45])]))).toMatch(/refunded in full/)
  })

  it("lets an order refunded in part ship", () => {
    expect(paymentBlocker(order(13.47, [captured(13.47, [4.99])]))).toBeNull()
  })
})
