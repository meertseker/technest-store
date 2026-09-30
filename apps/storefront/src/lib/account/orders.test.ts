import { describe, expect, it } from "vitest"
import { formatMoney, formatOrderDate, isClickAndCollect, orderStatus } from "./orders"

const collect = [{ name: "Click & Collect - Tech Nest" }]
const delivery = [{ name: "Standard delivery" }]

describe("orderStatus", () => {
  it("cancelled wins", () => {
    expect(orderStatus({ status: "canceled", fulfillment_status: "shipped" }).label).toBe("Cancelled")
  })

  it("delivery orders follow fulfilment", () => {
    expect(orderStatus({ status: "pending", fulfillment_status: "not_fulfilled", shipping_methods: delivery }).label).toBe(
      "Order placed"
    )
    expect(orderStatus({ fulfillment_status: "shipped", shipping_methods: delivery }).label).toBe("On its way")
    expect(orderStatus({ fulfillment_status: "delivered", shipping_methods: delivery }).tone).toBe("success")
  })

  it("Click & Collect: preparing, ready, collected (captured when staff press Collected)", () => {
    expect(orderStatus({ fulfillment_status: "not_fulfilled", shipping_methods: collect }).label).toBe("Preparing")
    expect(orderStatus({ fulfillment_status: "fulfilled", shipping_methods: collect }).label).toBe("Ready to collect")
    expect(orderStatus({ fulfillment_status: "fulfilled", payment_status: "captured", shipping_methods: collect }).label).toBe(
      "Collected"
    )
  })

  it("detects Click & Collect by the shipping method name", () => {
    expect(isClickAndCollect({ shipping_methods: collect })).toBe(true)
    expect(isClickAndCollect({ shipping_methods: delivery })).toBe(false)
    expect(isClickAndCollect({})).toBe(false)
  })
})

describe("formatting", () => {
  it("shows Medusa amounts as-is (major units, no division by 100)", () => {
    expect(formatMoney(3.49)).toBe("£3.49")
    expect(formatMoney(13.47, "gbp")).toBe("£13.47")
  })

  it("dates in London time", () => {
    expect(formatOrderDate("2026-09-30T23:30:00Z")).toBe("1 October 2026")
  })
})
