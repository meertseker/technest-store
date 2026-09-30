import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { TradeTiersResponse } from "@/lib/trade/types"
import TradeTierTable from "./trade-tier-table"

const data: TradeTiersResponse = {
  product_id: "prod_01",
  currency_code: "gbp",
  price_label: "ex VAT",
  vat_rate_percent: 20,
  variants: [
    {
      variant_id: "v1",
      sku: null,
      title: "iPhone 16",
      retail_inc_vat_pence: 999,
      tiers: [
        { min_quantity: 1, max_quantity: 9, unit_price_ex_vat_pence: 625, unit_price_inc_vat_pence: 750 },
        { min_quantity: 50, max_quantity: null, unit_price_ex_vat_pence: 500, unit_price_inc_vat_pence: 600 },
      ],
    },
    { variant_id: "v2", sku: null, title: "iPhone 15", retail_inc_vat_pence: 999, tiers: [] },
  ],
}

const render = (props: Parameters<typeof TradeTierTable>[0]) => renderToStaticMarkup(createElement(TradeTierTable, props))

describe("TradeTierTable", () => {
  it("shows ex VAT prices with a visible label, and inc VAT beside them", () => {
    const html = render({ data })
    expect(html).toContain("Your trade prices")
    expect(html).toContain(">ex VAT<")
    expect(html).toContain("£6.25")
    expect(html).toContain("£7.50 inc VAT")
    expect(html).toContain("50 or more")
    expect(html).toContain("Save 24%")
  })

  it("is a real table with row and column headers", () => {
    const html = render({ data })
    expect(html).toContain("<caption")
    expect(html).toContain('scope="col"')
    expect(html).toContain('scope="row"')
  })

  it("skips variants without tiers, and can show only the selected variant", () => {
    expect(render({ data })).not.toContain("iPhone 15")
    expect(render({ data, variantId: "v2" })).toBe("")
    expect(render({ data, variantId: "v1" })).toContain("Trade prices for iPhone 16")
  })

  it("renders nothing when no variant has trade prices", () => {
    expect(render({ data: { ...data, variants: [data.variants[1]] } })).toBe("")
  })
})
