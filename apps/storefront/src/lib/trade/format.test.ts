import { describe, expect, it } from "vitest"
import { formatUnitPence, parseTradeTiers, savingPercent, tierRange } from "./format"

const body = {
  product_id: "prod_01",
  currency_code: "gbp",
  price_label: "ex VAT",
  vat_rate_percent: 20,
  variants: [
    {
      variant_id: "variant_01",
      sku: "CLEAR-CASE-IPHONE-16",
      title: "iPhone 16",
      retail_inc_vat_pence: 999,
      tiers: [
        { min_quantity: 50, max_quantity: null, unit_price_ex_vat_pence: 500, unit_price_inc_vat_pence: 600 },
        { min_quantity: 1, max_quantity: 9, unit_price_ex_vat_pence: 625, unit_price_inc_vat_pence: 750 },
        { min_quantity: 10, max_quantity: 49, unit_price_ex_vat_pence: 583, unit_price_inc_vat_pence: 700 },
      ],
    },
  ],
}

describe("trade format", () => {
  it("formats integer pence as pounds (never Medusa major units)", () => {
    expect(formatUnitPence(625)).toBe("£6.25")
    expect(formatUnitPence(1000)).toBe("£10.00")
  })

  it("describes quantity bands", () => {
    expect(tierRange({ min_quantity: 1, max_quantity: 9 })).toBe("1 to 9")
    expect(tierRange({ min_quantity: 50, max_quantity: null })).toBe("50 or more")
    expect(tierRange({ min_quantity: 1, max_quantity: 1 })).toBe("1")
  })

  it("saving is against retail inc VAT, rounded down, only when cheaper", () => {
    expect(savingPercent(999, 750)).toBe(24)
    expect(savingPercent(999, 1200)).toBeNull()
    expect(savingPercent(null, 500)).toBeNull()
  })

  it("parses the contract body and sorts tiers by min_quantity", () => {
    const parsed = parseTradeTiers(body)!
    expect(parsed.variants[0].tiers.map((t) => t.min_quantity)).toEqual([1, 10, 50])
    expect(parsed.price_label).toBe("ex VAT")
  })

  it("rejects bodies that break the contract (hide rather than show wrong prices)", () => {
    expect(parseTradeTiers(null)).toBeNull()
    expect(parseTradeTiers({ variants: [] })).toBeNull()
    const decimal = structuredClone(body)
    decimal.variants[0].tiers[0].unit_price_ex_vat_pence = 5.5
    expect(parseTradeTiers(decimal)).toBeNull()
  })
})
