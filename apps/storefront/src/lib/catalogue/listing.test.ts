import { describe, expect, it } from "vitest"
import { countMatches, priceBand, sortProducts } from "./facets"
import { buildListing } from "./listing"
import { PAGE_SIZE, parseListingParams } from "./listing-params"
import { product } from "./test-fixtures"

const cable = product({
  id: "cable",
  created_at: "2026-09-03T00:00:00Z",
  options: ["Colour", "Length"],
  metadata: { connector_a: "USB-C", connector_b: "Lightning" },
  variants: [
    { id: "c1", price: 6.99, options: { Colour: "White", Length: "1m" } },
    { id: "c2", price: 8.99, options: { Colour: "Black", Length: "2m" } },
  ],
})
const charger = product({
  id: "charger",
  created_at: "2026-09-02T00:00:00Z",
  options: ["Colour"],
  product_attributes: { connector_a: "UK plug", connector_b: "USB-C", wattage: 20 },
  variants: [{ id: "ch1", price: 9.99, options: { Colour: "White" } }],
})
const hub = product({
  id: "hub",
  created_at: "2026-09-04T00:00:00Z",
  metadata: { connector_a: "USB-C", connector_b: "HDMI, USB-A, SD" },
  variants: [{ id: "h1", price: 24.99, qty: 0 }],
})
const pad = product({
  id: "pad",
  created_at: "2026-09-01T00:00:00Z",
  metadata: { platform: ["ps5"] },
  variants: [{ id: "p1", price: 1 }],
})
const all = [cable, charger, hub, pad]

describe("priceBand", () => {
  it.each([
    [1, "under-5"],
    [4.99, "under-5"],
    [5, "5-10"],
    [19.99, "10-20"],
    [20, "20-plus"],
  ])("£%s is %s", (price, band) => expect(priceBand(price)).toBe(band))
})

describe("buildListing: filters and facets", () => {
  it("shows everything with no filters, buyable items first for 'featured'", () => {
    const l = buildListing(all, parseListingParams({}))
    expect(l.total).toBe(4)
    expect(l.items.map((p) => p.id)).toEqual(["cable", "charger", "pad", "hub"])
    expect(l.fit).toEqual({ kind: "none" })
  })

  it("reads connectors from product_attributes, else metadata, and splits multi-port values", () => {
    const l = buildListing(all, parseListingParams({}))
    const connector = l.facets.find((f) => f.key === "connector")!
    expect(connector.options.map((o) => o.value)).toEqual(
      expect.arrayContaining(["usb-c", "lightning", "uk-plug", "hdmi", "usb-a", "sd"])
    )
    expect(connector.options.find((o) => o.value === "usb-c")).toMatchObject({
      label: "USB-C",
      count: 3,
    })
  })

  it("filters OR within a facet and AND across facets", () => {
    const one = buildListing(all, parseListingParams({ connector: ["lightning", "hdmi"] }))
    expect(one.items.map((p) => p.id).sort()).toEqual(["cable", "hub"])
    const two = buildListing(all, parseListingParams({ connector: "usb-c", colour: "white" }))
    expect(two.items.map((p) => p.id).sort()).toEqual(["cable", "charger"])
  })

  it("gives disjunctive counts: a facet's own selection doesn't shrink its counts", () => {
    const l = buildListing(all, parseListingParams({ colour: "black" }))
    const colour = l.facets.find((f) => f.key === "colour")!
    expect(colour.options.find((o) => o.value === "white")).toMatchObject({
      count: 2,
      selected: false,
    })
    expect(colour.options.find((o) => o.value === "black")).toMatchObject({
      count: 1,
      selected: true,
    })
    const price = l.facets.find((f) => f.key === "price")!
    // only the cable is black: its prices span the £5-£10 band only (nothing is in £10-£20)
    expect(price.options.map((o) => [o.value, o.count])).toEqual([
      ["under-5", 0],
      ["5-10", 1],
      ["20-plus", 0],
    ])
  })

  it("keeps a selected value with no matches so it can be removed, and labels chips", () => {
    const l = buildListing(all, parseListingParams({ platform: ["ps5", "switch"] }))
    expect(l.chips).toEqual([
      { key: "platform", value: "ps5", label: "Works with: PS5" },
      { key: "platform", value: "switch", label: "Works with: switch" },
    ])
    const platform = l.facets.find((f) => f.key === "platform")!
    expect(platform.options.find((o) => o.value === "switch")).toMatchObject({ count: 0 })
  })

  it("hides a facet that can't narrow the list", () => {
    const l = buildListing([pad], parseListingParams({}))
    expect(l.facets.map((f) => f.key)).not.toContain("platform")
  })

  it("the client index gives the same count as the server", () => {
    const state = parseListingParams({ connector: "usb-c", price: ["5-10", "20-plus"] })
    const l = buildListing(all, state)
    expect(countMatches(l.index, state.filters)).toBe(l.total)
    expect(l.index[0]).not.toHaveProperty("title")
  })

  it("uses the sub-category facet when given", () => {
    const withCats = [
      product({ id: "a", categories: ["cases"] }),
      product({ id: "b", categories: ["glass"] }),
    ]
    const facet = new Map([
      ["cases", { value: "cases", label: "Cases" }],
      ["glass", { value: "screen-protectors", label: "Screen Protectors" }],
    ])
    const l = buildListing(withCats, parseListingParams({ category: "screen-protectors" }), {
      categoryFacet: facet,
    })
    expect(l.items.map((p) => p.id)).toEqual(["b"])
    expect(l.chips[0].label).toBe("Type: Screen Protectors")
  })
})

describe("buildListing: device fit", () => {
  const device = (ids: string[] | null) => ({
    label: "iPhone 16",
    productIds: ids ? new Set(ids) : null,
  })

  it("filters to the device's products by default", () => {
    const l = buildListing(all, parseListingParams({}), { device: device(["cable"]) })
    expect(l.items.map((p) => p.id)).toEqual(["cable"])
    expect(l.fit).toEqual({ kind: "filtered", device: "iPhone 16", total: 4 })
    expect(l.fitIds).toEqual(["cable"])
  })

  it("shows all when asked, still knowing which fit", () => {
    const l = buildListing(all, parseListingParams({ fit: "all" }), { device: device(["cable"]) })
    expect(l.total).toBe(4)
    expect(l.fit).toEqual({ kind: "all", device: "iPhone 16", fitting: 1 })
  })

  it("doesn't filter when nothing in scope is matched to devices", () => {
    const l = buildListing(all, parseListingParams({}), { device: device(["other"]) })
    expect(l.total).toBe(4)
    expect(l.fit).toEqual({ kind: "not-applicable", device: "iPhone 16" })
  })

  it("doesn't filter when the device list is unknown", () => {
    const l = buildListing(all, parseListingParams({}), { device: device(null) })
    expect(l.total).toBe(4)
    expect(l.fit.kind).toBe("none")
  })
})

describe("buildListing: sort and pages", () => {
  it("sorts by price both ways, unpriced last", () => {
    const unpriced = product({ id: "nop", variants: [{ id: "n", price: null }] })
    const list = [unpriced, ...all]
    expect(sortProducts(list, "price-asc").map((p) => p.id)).toEqual([
      "pad",
      "cable",
      "charger",
      "hub",
      "nop",
    ])
    expect(sortProducts(list, "price-desc").map((p) => p.id)).toEqual([
      "hub",
      "charger",
      "cable",
      "pad",
      "nop",
    ])
  })

  it("sorts newest first", () => {
    expect(sortProducts(all, "newest").map((p) => p.id)).toEqual(["hub", "cable", "charger", "pad"])
  })

  it("shows 24 per page, cumulatively for Load more", () => {
    const many = Array.from({ length: 50 }, (_, i) => product({ id: `p${i}` }))
    const p1 = buildListing(many, parseListingParams({}))
    expect(p1.items).toHaveLength(PAGE_SIZE)
    expect(p1.hasMore).toBe(true)
    const p2 = buildListing(many, parseListingParams({ page: "2" }))
    expect(p2.items).toHaveLength(48)
    const p3 = buildListing(many, parseListingParams({ page: "3" }))
    expect(p3.items).toHaveLength(50)
    expect(p3.hasMore).toBe(false)
  })
})
