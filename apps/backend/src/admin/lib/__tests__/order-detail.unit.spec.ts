import { canCancel, describePayment, parseRefund, summarisePayments, toPence } from "../order-detail"

const order = (payments: object[], extra: object = {}) => ({
  status: "pending",
  fulfillment_status: "not_fulfilled",
  payment_collections: [{ payments }],
  ...extra,
})

describe("toPence", () => {
  it("turns Medusa's major units into integer pence without float drift", () => {
    expect(toPence(3.49)).toBe(349)
    expect(toPence("1")).toBe(100)
    expect(toPence(0.1 + 0.2)).toBe(30)
    expect(toPence(null)).toBe(0)
    expect(toPence("abc")).toBe(0)
  })
})

describe("summarisePayments", () => {
  it("counts an authorised, uncaptured payment as held", () => {
    const s = summarisePayments(order([{ id: "pay_1", amount: 1, captures: [], refunds: [] }]))
    expect(s).toMatchObject({ held_pence: 100, captured_pence: 0, refundable_pence: 0, released: false })
  })

  it("offers what was captured minus what was refunded, on the right payment", () => {
    const s = summarisePayments(
      order([
        { id: "pay_1", amount: 10, captures: [{ amount: 10 }], refunds: [{ amount: 2.5 }] },
        { id: "pay_2", amount: 3, captures: [{ amount: 3 }], refunds: [] },
      ])
    )
    expect(s).toMatchObject({ captured_pence: 1300, refunded_pence: 250, refundable_pence: 750, refund_payment_id: "pay_1" })
  })

  it("marks a fully cancelled payment as released, not held", () => {
    const s = summarisePayments(order([{ id: "pay_1", amount: 1, canceled_at: "2026-10-23T20:00:00Z" }]))
    expect(s).toMatchObject({ held_pence: 0, released: true })
  })

  it("copes with an order without payments", () => {
    expect(summarisePayments({})).toMatchObject({ held_pence: 0, refund_payment_id: null, released: false })
  })
})

describe("describePayment", () => {
  const base = { held_pence: 0, captured_pence: 0, refunded_pence: 0, refundable_pence: 0, refund_payment_id: null, released: false }

  it("tells Click & Collect staff the money is taken on Collected", () => {
    expect(describePayment({ ...base, held_pence: 100 }, true)).toBe(
      "£1.00 is held on the card. It is taken when you press Collected."
    )
  })

  it("reports paid, part-refunded and fully refunded orders", () => {
    expect(describePayment({ ...base, captured_pence: 1000 }, false)).toBe("£10.00 paid.")
    expect(describePayment({ ...base, captured_pence: 1000, refunded_pence: 250 }, false)).toBe(
      "£10.00 paid, £2.50 refunded so far."
    )
    expect(describePayment({ ...base, captured_pence: 1000, refunded_pence: 1000 }, false)).toBe(
      "£10.00 was paid and has been refunded in full."
    )
  })

  it("says nothing was taken when the hold was released", () => {
    expect(describePayment({ ...base, released: true }, true)).toBe("The card hold was released. No money was taken.")
  })
})

describe("canCancel", () => {
  const s = summarisePayments(order([{ id: "p", amount: 1 }]))

  it("allows cancelling an untouched order whose card is only held", () => {
    expect(canCancel(order([]), s)).toBe(true)
  })

  it("refuses once money was taken, goods left, or the order is closed", () => {
    const paid = summarisePayments(order([{ id: "p", amount: 1, captures: [{ amount: 1 }] }]))
    expect(canCancel(order([]), paid)).toBe(false)
    expect(canCancel(order([], { fulfillment_status: "fulfilled" }), s)).toBe(false)
    expect(canCancel(order([], { status: "canceled" }), s)).toBe(false)
    expect(canCancel(order([], { status: "completed" }), s)).toBe(false)
  })
})

describe("parseRefund", () => {
  it("accepts pounds with or without the sign and pence", () => {
    expect(parseRefund("1", 100)).toEqual({ pence: 100 })
    expect(parseRefund("£0.50", 100)).toEqual({ pence: 50 })
    expect(parseRefund(" 1,000.5 ", 200000)).toEqual({ pence: 100050 })
  })

  it("refuses nonsense, zero and more than is left", () => {
    expect(parseRefund("abc", 100)).toHaveProperty("error")
    expect(parseRefund("1.234", 1000)).toHaveProperty("error")
    expect(parseRefund("0", 100)).toEqual({ error: "The amount must be more than £0." })
    expect(parseRefund("2", 100)).toEqual({ error: "You can refund at most £1.00." })
  })
})
