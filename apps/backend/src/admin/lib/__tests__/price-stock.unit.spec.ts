import { inputsToRefresh, isStaleStockError, priceStockBody, stockInputToNumber, variantRows } from "../price-stock"

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

describe("priceStockBody", () => {
  const row = { price_pence: 499, stock: 3 }

  it("sends only what changed, and the stock the page showed with the stock", () => {
    expect(priceStockBody(row, { price_pence: 549, stock: 3 })).toEqual({ price_pence: 549 })
    expect(priceStockBody(row, { price_pence: 499, stock: 7 })).toEqual({ stock: 7, expected_stock: 3 })
    expect(priceStockBody(row, { price_pence: 549, stock: 7 })).toEqual({ price_pence: 549, stock: 7, expected_stock: 3 })
  })

  it("sends expected_stock null when the page showed no stock", () => {
    expect(priceStockBody({ price_pence: null, stock: null }, { price_pence: null, stock: 2 })).toEqual({
      stock: 2,
      expected_stock: null,
    })
  })

  it("sends nothing when nothing changed", () => {
    expect(priceStockBody(row, { price_pence: 499, stock: 3 })).toEqual({})
    expect(priceStockBody(row, { price_pence: null, stock: null })).toEqual({})
  })
})

describe("isStaleStockError", () => {
  it("recognises the server's 409 for stock that moved since the page loaded", () => {
    expect(isStaleStockError(Object.assign(new Error("The stock for this product is now 2, not 3."), { status: 409 }))).toBe(true)
    expect(isStaleStockError(Object.assign(new Error("Something else"), { status: 400 }))).toBe(false)
    expect(isStaleStockError(new Error("no status"))).toBe(false)
    expect(isStaleStockError(null)).toBe(false)
  })
})

describe("inputsToRefresh", () => {
  it("refreshes only the stock field when only the stock moved (a typed price survives a 409 reload)", () => {
    expect(inputsToRefresh({ price_pence: 499, stock: 5 }, { price_pence: 499, stock: 4 })).toEqual({ price: false, stock: true })
  })

  it("refreshes the price when the server price changed", () => {
    expect(inputsToRefresh({ price_pence: 499, stock: 5 }, { price_pence: 549, stock: 5 })).toEqual({ price: true, stock: false })
    expect(inputsToRefresh({ price_pence: null, stock: null }, { price_pence: 100, stock: 1 })).toEqual({ price: true, stock: true })
  })

  it("refreshes nothing when the row is unchanged", () => {
    expect(inputsToRefresh({ price_pence: 499, stock: 5 }, { price_pence: 499, stock: 5 })).toEqual({ price: false, stock: false })
  })
})
