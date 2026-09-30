import { describe, expect, it } from "vitest"
import { isAddonItem, isAddonOnlyBasket, isAddonProduct, parseBasketRules } from "./addon"

const addon = { product_id: "p1", product: { product_attributes: { is_addon_item: true } } }
const legacyAddon = { product_id: "p2", product: { metadata: { is_addon_item: true } } }
const normal = { product_id: "p3", product: { product_attributes: { is_addon_item: false }, metadata: {} } }

describe("add-on detection", () => {
  it("reads product_attributes.is_addon_item first", () => {
    expect(isAddonProduct(addon.product)).toBe(true)
    expect(isAddonProduct(normal.product)).toBe(false)
    // attributes win over stale metadata
    expect(
      isAddonProduct({ product_attributes: { is_addon_item: false }, metadata: { is_addon_item: true } })
    ).toBe(false)
  })

  it("falls back to the provisional metadata flag, real booleans only", () => {
    expect(isAddonProduct(legacyAddon.product)).toBe(true)
    expect(isAddonProduct({ metadata: { is_addon_item: "true" } })).toBe(false)
    expect(isAddonProduct(null)).toBe(false)
  })

  it("uses separately looked-up product ids", () => {
    expect(isAddonItem({ product_id: "p9", product: null }, new Set(["p9"]))).toBe(true)
  })

  it("flags a basket made only of add-ons", () => {
    expect(isAddonOnlyBasket([addon, legacyAddon])).toBe(true)
    expect(isAddonOnlyBasket([addon, normal])).toBe(false)
    expect(isAddonOnlyBasket([])).toBe(false)
    expect(isAddonOnlyBasket(undefined)).toBe(false)
  })
})

describe("parseBasketRules", () => {
  it("accepts the likely backend shapes", () => {
    expect(parseBasketRules({ basket_rules: { addon_only: true } })).toEqual({ addon_only: true, source: "backend" })
    expect(parseBasketRules({ delivery_allowed: false })).toEqual({ addon_only: true, source: "backend" })
  })

  it("returns null for anything else", () => {
    expect(parseBasketRules(null)).toBeNull()
    expect(parseBasketRules("<html>")).toBeNull()
    expect(parseBasketRules({ basket_rules: {} })).toBeNull()
  })
})
