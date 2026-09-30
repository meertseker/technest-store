import { describe, expect, it } from "vitest"
import { DEFAULT_FREE_DELIVERY_THRESHOLD_PENCE, freeDeliveryProgress } from "./free-delivery"
import { formatGbp, formatPenceExact, toPence } from "./money"

describe("freeDeliveryProgress (pence)", () => {
  it("defaults to the contract's GBP 20", () => {
    expect(DEFAULT_FREE_DELIVERY_THRESHOLD_PENCE).toBe(2000)
  })

  it("works out what is left and the percentage", () => {
    expect(freeDeliveryProgress(1650, 2000)).toEqual({
      remaining_pence: 350,
      percent: 82,
      qualified: false,
    })
  })

  it("never shows 100% while a penny is missing", () => {
    expect(freeDeliveryProgress(1999, 2000)).toEqual({
      remaining_pence: 1,
      percent: 99,
      qualified: false,
    })
  })

  it("qualifies at exactly the threshold and above", () => {
    expect(freeDeliveryProgress(2000, 2000).qualified).toBe(true)
    expect(freeDeliveryProgress(4599, 2000)).toEqual({ remaining_pence: 0, percent: 100, qualified: true })
  })

  it("handles an empty basket and a zero threshold", () => {
    expect(freeDeliveryProgress(0, 2000)).toEqual({ remaining_pence: 2000, percent: 0, qualified: false })
    expect(freeDeliveryProgress(0, 0).qualified).toBe(true)
  })
})

describe("money boundary", () => {
  it("converts Medusa major units to pence without float noise", () => {
    expect(toPence(3.49)).toBe(349)
    expect(toPence(0.1 + 0.2)).toBe(30)
    expect(toPence(16.5)).toBe(1650)
    expect(toPence(undefined)).toBe(0)
  })

  it("formats major units as-is (never divides by 100)", () => {
    expect(formatGbp(3.49)).toBe("£3.49")
    expect(formatGbp(1)).toBe("£1.00")
    expect(formatPenceExact(350)).toBe("£3.50")
  })
})
