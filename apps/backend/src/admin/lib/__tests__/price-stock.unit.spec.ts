import { stockInputToNumber, variantRows } from "../price-stock"

describe("variantRows", () => {
  it("flattens products into one row per variant with the plain GBP price in pence", () => {
    const rows = variantRows([
      {
        id: "prod_1",
        title: "USB-C cable",
        status: "published",
        thumbnail: "https://x/1.jpg",
        variants: [
          {
            id: "var_1",
            title: "1 m",
            sku: "CAB-1",
            inventory_items: [{ inventory: { location_levels: [{ stocked_quantity: 4 }] } }],
            prices: [
              { currency_code: "eur", amount: 5.5 },
              { currency_code: "gbp", amount: 4.99 },
              { currency_code: "gbp", amount: 3.99, price_list_id: "plist_trade" },
            ],
          },
          {
            id: "var_2",
            title: "2 m",
            sku: null,
            inventory_items: [{ inventory: { location_levels: [{ stocked_quantity: "0" }] } }],
            prices: [{ currency_code: "gbp", amount: 6.49 }],
          },
        ],
      },
    ])
    expect(rows).toEqual([
      {
        product_id: "prod_1",
        variant_id: "var_1",
        product_title: "USB-C cable",
        variant_title: "1 m",
        sku: "CAB-1",
        thumbnail: "https://x/1.jpg",
        status: "published",
        price_pence: 499,
        stock: 4,
      },
      expect.objectContaining({ variant_id: "var_2", variant_title: "2 m", sku: null, price_pence: 649, stock: 0 }),
    ])
  })

  it("hides the title of a lone Default variant, and copes with no GBP price or no stock level", () => {
    const [row] = variantRows([
      {
        id: "prod_2",
        title: "Case",
        status: "draft",
        variants: [{ id: "var_3", title: "Default", prices: [{ currency_code: "eur", amount: 9 }] }],
      },
    ])
    expect(row).toMatchObject({ variant_title: null, status: "draft", price_pence: null, stock: null, thumbnail: null })
  })

  it("ignores region-scoped prices (rules) when picking the retail price", () => {
    const [row] = variantRows([
      {
        id: "p",
        title: "T",
        variants: [
          {
            id: "v",
            prices: [
              { currency_code: "gbp", amount: 3.5, rules_count: 1 },
              { currency_code: "gbp", amount: 3.99, rules_count: 0 },
            ],
          },
        ],
      },
    ])
    expect(row.price_pence).toBe(399)
  })
})

describe("stockInputToNumber", () => {
  it("accepts whole numbers up to 100000 and nothing else", () => {
    expect(stockInputToNumber(" 12 ")).toBe(12)
    expect(stockInputToNumber("0")).toBe(0)
    expect(stockInputToNumber("100000")).toBe(100000)
    expect(stockInputToNumber("100001")).toBeNull()
    expect(stockInputToNumber("-1")).toBeNull()
    expect(stockInputToNumber("1.5")).toBeNull()
    expect(stockInputToNumber("")).toBeNull()
    expect(stockInputToNumber("ten")).toBeNull()
  })
})
