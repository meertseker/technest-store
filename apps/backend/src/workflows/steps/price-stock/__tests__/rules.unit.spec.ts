import { plainGbpPrices } from "../load-variant-price-stock"
import { stockChangeProblem } from "../set-variant-stock"

describe("plainGbpPrices", () => {
  const price = (over: Record<string, unknown> = {}) => ({
    id: "price_1",
    currency_code: "gbp",
    amount: 5.49,
    price_list_id: null,
    rules_count: 0,
    min_quantity: null,
    max_quantity: null,
    ...over,
  })

  it("is the GBP price with no price list, no rules and no quantity tier", () => {
    const plain = price()
    expect(
      plainGbpPrices([
        price({ id: "list", price_list_id: "plist_1" }),
        price({ id: "ruled", rules_count: 1 }),
        price({ id: "tier", min_quantity: 10 }),
        price({ id: "capped", max_quantity: 5 }),
        price({ id: "eur", currency_code: "eur" }),
        null,
        plain,
      ])
    ).toEqual([plain])
  })

  it("returns every candidate when a variant has more than one", () => {
    expect(plainGbpPrices([price({ id: "a" }), price({ id: "b" })]).map((p) => p.id)).toEqual(["a", "b"])
    expect(plainGbpPrices(null)).toEqual([])
  })
})

describe("stockChangeProblem", () => {
  it("allows a change from the stock the page showed", () => {
    expect(stockChangeProblem({ current: 10, reserved: 0, desired: 15, expected: 10 })).toBeNull()
    expect(stockChangeProblem({ current: 10, reserved: 2, desired: 2, expected: 10 })).toBeNull()
    // a caller that does not say what it saw is not checked against it
    expect(stockChangeProblem({ current: 10, reserved: 0, desired: 15 })).toBeNull()
    // first stock for an item with no level yet
    expect(stockChangeProblem({ current: null, reserved: 0, desired: 4, expected: null })).toBeNull()
  })

  it("refuses when the stock changed since the page was loaded", () => {
    const sold = stockChangeProblem({ current: 8, reserved: 0, desired: 15, expected: 10 })
    expect(sold).toEqual({ type: "conflict", message: expect.stringMatching(/now 8.*not 10/) })
    const appeared = stockChangeProblem({ current: 3, reserved: 0, desired: 15, expected: null })
    expect(appeared?.type).toBe("conflict")
  })

  it("refuses to go below what is set aside for orders not yet sent", () => {
    const problem = stockChangeProblem({ current: 5, reserved: 2, desired: 0, expected: 5 })
    expect(problem).toEqual({ type: "invalid_data", message: expect.stringMatching(/2 .*set aside/) })
    expect(stockChangeProblem({ current: 5, reserved: 2, desired: 1 })?.type).toBe("invalid_data")
  })
})
