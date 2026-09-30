import { describe, expect, it } from "vitest"
import { plainEnglish, readAttributes, specRows } from "./attributes"
import { ancestry, categoryPath, descendantIds, resolveCategory, subcategoryFacet } from "./categories"
import { deliveryLines, toPence } from "./delivery"
import { breadcrumbJsonLd, productJsonLd, schemaPrice } from "./json-ld"
import { product } from "./test-fixtures"
import {
  findVariant,
  initialSelection,
  isOnSale,
  maxQuantity,
  optionChoices,
  priceRange,
  stockLabel,
  stockState,
} from "./variants"

const case_ = product({
  id: "case",
  handle: "silicone-case",
  title: "Silicone Case",
  options: ["Colour", "Model"],
  variants: [
    { id: "b15", price: 9.99, options: { Colour: "Black", Model: "iPhone 15" } },
    { id: "b16", price: 9.99, options: { Colour: "Black", Model: "iPhone 16" }, qty: 0 },
    { id: "p16", price: 11.99, options: { Colour: "Pink", Model: "iPhone 16" }, qty: 2 },
  ],
})

describe("prices (Medusa major units, never divided)", () => {
  it("gives the variant price range as returned", () => {
    expect(priceRange(case_)).toEqual({ min: 9.99, max: 11.99 })
  })
  it("detects a sale", () => {
    const sale = product({ id: "s", variants: [{ id: "v", price: 4, was: 5 }] })
    expect(isOnSale(sale.variants[0])).toBe(true)
    expect(isOnSale(case_.variants[0])).toBe(false)
  })
  it("converts to pence only at the boundary", () => {
    expect(toPence(9.99)).toBe(999)
    expect(toPence(0.1 + 0.2)).toBe(30)
  })
})

describe("stock", () => {
  it.each([
    [{ managed: true, qty: 12 }, "In stock · 12 available"],
    [{ managed: true, qty: 3 }, "Low stock · only 3 left"],
    [{ managed: true, qty: 0 }, "Out of stock"],
    [{ managed: false, qty: 0 }, "In stock"],
    [{ managed: true, qty: 0, backorder: true }, "In stock"],
  ])("%j -> %s", (v, label) => {
    const p = product({ id: "x", variants: [{ id: "v", ...v }] })
    expect(stockLabel(stockState(p.variants[0]))).toBe(label)
  })
  it("caps the quantity at stock and at 20", () => {
    expect(maxQuantity(case_.variants[2])).toBe(2)
    const lots = product({ id: "l", variants: [{ id: "v", qty: 500 }] })
    expect(maxQuantity(lots.variants[0])).toBe(20)
    expect(maxQuantity(case_.variants[1])).toBe(0)
  })
})

describe("variant choice", () => {
  it("lists option values and marks what can be bought with the current choice", () => {
    const choices = optionChoices(case_, { opt_Model: "iPhone 16" })
    const colour = choices.find((c) => c.title === "Colour")!
    expect(colour.values).toEqual([
      { value: "Black", exists: true, available: false },
      { value: "Pink", exists: true, available: true },
    ])
    const model = choices.find((c) => c.title === "Model")!
    expect(model.values.map((v) => v.value)).toEqual(["iPhone 15", "iPhone 16"])
  })

  it("finds the variant only when every varying option is chosen", () => {
    expect(findVariant(case_, { opt_Colour: "Pink" })).toBeNull()
    expect(findVariant(case_, { opt_Colour: "Pink", opt_Model: "iPhone 16" })?.id).toBe("p16")
    const single = product({ id: "one", variants: [{ id: "only" }] })
    expect(findVariant(single, {})?.id).toBe("only")
  })

  it("preselects the shopper's device model, preferring a variant in stock", () => {
    expect(initialSelection(case_, { deviceModel: "iPhone 16" })).toEqual({
      opt_Colour: "Pink",
      opt_Model: "iPhone 16",
    })
    expect(initialSelection(case_, { variantId: "b15" })).toEqual({
      opt_Colour: "Black",
      opt_Model: "iPhone 15",
    })
    expect(initialSelection(case_, {})).toEqual({})
  })
})

describe("attributes", () => {
  it("prefers product_attributes and falls back to metadata, with defaults", () => {
    expect(readAttributes({ product_attributes: { wattage: 20 }, metadata: { wattage: 5 } }).wattage).toBe(20)
    expect(readAttributes({ metadata: { safety_marking: "UKCA" } }).safety_marking).toBe("UKCA")
    expect(readAttributes({})).toMatchObject({ platform: [], is_addon_item: false, safety_marking: "none" })
  })
  it("builds spec rows and a plain-English summary from facts only", () => {
    const a = readAttributes({
      metadata: { connector_a: "USB-C", connector_b: "Lightning", cable_length_m: 1, safety_marking: "CE", warranty_months: 6, platform: ["ps5"] },
    })
    expect(specRows(a).map((r) => `${r.label}: ${r.value}`)).toEqual([
      "Connector: USB-C",
      "Other end: Lightning",
      "Cable length: 1 m",
      "Works with: PS5",
      "Safety marking: CE",
      "Warranty: 6 months",
    ])
    expect(plainEnglish(a)[0]).toBe("Connects USB-C to Lightning.")
    expect(plainEnglish(readAttributes({}))).toEqual([])
  })
})

describe("categories", () => {
  const cats = [
    { id: "pa", name: "Phone Accessories", handle: "phone-accessories", parent_category_id: null, rank: 0 },
    { id: "cs", name: "Cases", handle: "cases", parent_category_id: "pa", rank: 0 },
    { id: "gl", name: "Screen Protectors", handle: "screen-protectors", parent_category_id: "pa", rank: 1 },
    { id: "cl", name: "Clear cases", handle: "clear-cases", parent_category_id: "cs", rank: 0 },
  ]
  it("builds the canonical path from the ancestor chain", () => {
    expect(categoryPath(cats, cats[3])).toBe("/c/phone-accessories/cases/clear-cases")
    expect(ancestry(cats, cats[1]).map((c) => c.handle)).toEqual(["phone-accessories", "cases"])
  })
  it("resolves full and suffix paths, rejects wrong parents", () => {
    expect(resolveCategory(cats, ["phone-accessories", "cases"])).toMatchObject({ exact: true })
    expect(resolveCategory(cats, ["cases"])).toMatchObject({
      exact: false,
      canonical: "/c/phone-accessories/cases",
    })
    expect(resolveCategory(cats, ["screen-protectors", "cases"])).toBeNull()
    expect(resolveCategory(cats, ["nope"])).toBeNull()
  })
  it("collects descendants and maps them to the direct child for the Type facet", () => {
    expect(descendantIds(cats, "pa").sort()).toEqual(["cl", "cs", "gl", "pa"])
    const facet = subcategoryFacet(cats, "pa")!
    expect(facet.get("cl")).toEqual({ value: "cases", label: "Cases" })
    expect(subcategoryFacet(cats, "gl")).toBeNull()
  })
})

describe("JSON-LD", () => {
  it("has a Product with an AggregateOffer in GBP when prices differ, and no rating", () => {
    const ld = productJsonLd("https://technest.test/", { ...case_, description: "Soft touch" })
    expect(ld).toMatchObject({
      "@type": "Product",
      name: "Silicone Case",
      url: "https://technest.test/p/silicone-case",
      description: "Soft touch",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "GBP",
        lowPrice: "9.99",
        highPrice: "11.99",
        availability: "https://schema.org/InStock",
      },
    })
    expect(JSON.stringify(ld)).not.toContain("AggregateRating")
  })
  it("has a single Offer when every variant costs the same", () => {
    const one = product({ id: "o", handle: "o", variants: [{ id: "v", price: 1, qty: 0, sku: "SKU1" }] })
    const ld = productJsonLd("https://t.test", { ...one, title: "One" }) as { offers: object; sku: string }
    expect(ld.offers).toMatchObject({ "@type": "Offer", price: "1.00", availability: "https://schema.org/OutOfStock" })
    expect(ld.sku).toBe("SKU1")
    expect(schemaPrice(3.5)).toBe("3.50")
  })
  it("numbers breadcrumbs from 1 with absolute URLs", () => {
    expect(breadcrumbJsonLd("https://t.test", [{ name: "Home", path: "/" }, { name: "Cases", path: "/c/cases" }])).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://t.test" },
        { "@type": "ListItem", position: 2, name: "Cases", item: "https://t.test/c/cases" },
      ],
    })
  })
})

describe("delivery box", () => {
  it("shows free Click & Collect, the Standard price and the free threshold", () => {
    const lines = deliveryLines({ thresholdPence: 2000, closesToday: "8pm", itemPricePence: 999 })
    expect(lines.map((l) => l.title)).toEqual([
      "Click & Collect: free",
      "Standard delivery",
      "Next-day delivery",
    ])
    expect(lines[0].detail).toContain("Open today until 8pm")
    expect(lines[1].detail).toBe("£3.49, free on orders of £20 or more.")
  })
  it("says Standard is free when this item alone reaches the threshold", () => {
    const lines = deliveryLines({ thresholdPence: 2000, closesToday: null, itemPricePence: 2499 })
    expect(lines[1].detail).toBe("Free with this item (orders of £20 or more).")
    expect(lines[0].detail).toContain("We email you when it's ready")
  })
})
