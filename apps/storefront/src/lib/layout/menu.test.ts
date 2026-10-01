import { describe, expect, it } from "vitest"
import { activeSection, buildShopMenu } from "./menu"

const cats = [
  { id: "au", name: "Audio", handle: "audio", parent_category_id: null, rank: 1 },
  { id: "pa", name: "Phone Accessories", handle: "phone-accessories", parent_category_id: null, rank: 0 },
  { id: "gl", name: "Screen Protectors", handle: "screen-protectors", parent_category_id: "pa", rank: 1 },
  { id: "cs", name: "Cases", handle: "cases", parent_category_id: "pa", rank: 0 },
  { id: "ep", name: "Earphones", handle: "earphones", parent_category_id: "au", rank: 4 },
  { id: "d1", name: "£1 Deals", handle: "1-deals", parent_category_id: null, rank: 4 },
]

describe("buildShopMenu", () => {
  it("groups subcategories under their top-level category, in rank order, with canonical paths", () => {
    expect(buildShopMenu(cats)).toEqual([
      {
        name: "Phone Accessories",
        href: "/c/phone-accessories",
        children: [
          { name: "Cases", href: "/c/phone-accessories/cases" },
          { name: "Screen Protectors", href: "/c/phone-accessories/screen-protectors" },
        ],
      },
      { name: "Audio", href: "/c/audio", children: [{ name: "Earphones", href: "/c/audio/earphones" }] },
      { name: "£1 Deals", href: "/c/1-deals", children: [] },
    ])
  })

  it("is empty without categories (backend down), so the menu falls back to plain links", () => {
    expect(buildShopMenu([])).toEqual([])
  })
})

describe("activeSection", () => {
  it.each([
    ["/c/phone-accessories/cases", "shop"],
    ["/p/silicone-case", "shop"],
    ["/search", "shop"],
    ["/devices/apple/iphone-15", "shop"],
    ["/collections/best-sellers", "shop"],
    ["/repairs", "repairs"],
    ["/repairs/book", "repairs"],
    ["/trade/apply", "trade"],
    ["/account/trade", "account"],
    ["/account", "account"],
  ])("%s -> %s", (path, section) => {
    expect(activeSection(path)).toBe(section)
  })

  it("is null on pages outside the main sections", () => {
    expect(activeSection("/")).toBeNull()
    expect(activeSection("/tradewinds")).toBeNull()
    expect(activeSection("/contact")).toBeNull()
  })
})
