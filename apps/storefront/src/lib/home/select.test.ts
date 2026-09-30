import { describe, expect, it } from "vitest"
import {
  formatGbp,
  minPrice,
  parseDealsTab,
  pickCategoryTiles,
  pickNewIn,
  pickOnePound,
  pickUnderFive,
} from "./select"

const cat = (id: string, rank: number, parent: string | null = null, handle = id) => ({
  id,
  name: id,
  handle,
  rank,
  parent_category_id: parent,
})

describe("pickCategoryTiles", () => {
  const cats = [
    cat("audio", 1),
    cat("phone", 0),
    cat("deals", 4, null, "1-deals"),
    cat("gaming", 2),
    cat("cases", 0, "phone"),
    cat("screens", 1, "phone"),
    cat("chargers", 2, "phone"),
    cat("earphones", 0, "audio"),
    cat("headphones", 1, "audio"),
    cat("controllers", 0, "gaming"),
    cat("repairs-only", 5), // top level, no children
  ]

  it("takes sub-categories in turns across departments, by rank", () => {
    expect(pickCategoryTiles(cats, 8).map((c) => c.id)).toEqual([
      "cases",
      "earphones",
      "controllers",
      "repairs-only",
      "screens",
      "headphones",
      "chargers",
    ])
  })

  it("stops at the count and never includes the £1 range", () => {
    const ids = pickCategoryTiles(cats, 3).map((c) => c.id)
    expect(ids).toEqual(["cases", "earphones", "controllers"])
    expect(pickCategoryTiles(cats, 20).map((c) => c.handle)).not.toContain("1-deals")
  })

  it("returns nothing for no categories", () => {
    expect(pickCategoryTiles([], 8)).toEqual([])
  })
})

const product = (
  id: string,
  prices: number[],
  opts: { created?: string; addon?: boolean; cats?: string[] } = {}
) => ({
  id,
  created_at: opts.created ?? "2026-01-01T00:00:00Z",
  metadata: opts.addon ? { is_addon_item: true } : {},
  categories: (opts.cats ?? []).map((handle) => ({ handle })),
  variants: prices.map((p) => ({ calculated_price: { calculated_amount: p } })),
})

describe("deals", () => {
  const products = [
    product("lanyard", [1], { addon: true, created: "2026-03-01T00:00:00Z" }),
    product("cloth", [1], { cats: ["1-deals"], created: "2026-04-01T00:00:00Z" }),
    product("lens", [3.99]),
    product("adapter", [4.99]),
    product("glass", [4.99, 6.99]),
    product("five", [5]),
    product("case", [9.99]),
    product("unpriced", []),
  ]

  it("£1 tab: add-on flag or the 1-deals category, newest first", () => {
    expect(pickOnePound(products).map((p) => p.id)).toEqual(["cloth", "lanyard"])
  })

  it("Under £5: strictly below £5, cheapest variant counts, no £1 items, cheapest first", () => {
    expect(pickUnderFive(products).map((p) => p.id)).toEqual(["lens", "adapter", "glass"])
    expect(pickUnderFive(products, 2)).toHaveLength(2)
  })

  it("never divides or multiplies prices (major units as stored)", () => {
    expect(minPrice(product("x", [3.49, 12]))).toBe(3.49)
    expect(minPrice(product("y", []))).toBeNull()
  })

  it("parses the tab from the query string", () => {
    expect(parseDealsTab("under-5")).toBe("under-5")
    expect(parseDealsTab("one-pound")).toBe("one-pound")
    expect(parseDealsTab(undefined)).toBe("one-pound")
    expect(parseDealsTab(["under-5"])).toBe("one-pound")
  })
})

describe("pickNewIn", () => {
  it("newest priced products, without £1 add-ons", () => {
    const list = [
      product("old", [9], { created: "2026-01-01T00:00:00Z" }),
      product("new", [9], { created: "2026-05-01T00:00:00Z" }),
      product("addon", [1], { addon: true, created: "2026-06-01T00:00:00Z" }),
      product("noprice", [], { created: "2026-07-01T00:00:00Z" }),
    ]
    expect(pickNewIn(list).map((p) => p.id)).toEqual(["new", "old"])
  })
})

describe("formatGbp", () => {
  it("formats major units in GBP", () => {
    expect(formatGbp(1)).toBe("£1")
    expect(formatGbp(3.49)).toBe("£3.49")
    expect(formatGbp(12.5)).toBe("£12.50")
  })
})
