import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { parseListingParams } from "@/lib/catalogue/listing-params"
import { fitResult } from "@/lib/catalogue/fit"
import { groupByCategory } from "@/lib/catalogue/group"
import { deliveryLines } from "@/lib/catalogue/delivery"
import { nextActive, suggestionsFromHits } from "@modules/search/components/suggestions"
import { DeliveryBox, FitBox, Specs } from "../pdp/parts"
import Breadcrumbs from "./breadcrumbs"
import { ActiveChips, EmptyState, FitBanner, LoadMore } from "./listing-parts"

const render = (el: React.ReactElement) => renderToStaticMarkup(el)
const nav = (sp: Record<string, string | string[]> = {}) => ({
  state: parseListingParams(sp),
  pathname: "/c/phone-accessories/cases",
  defaultSort: "featured" as const,
})

describe("<Breadcrumbs>", () => {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Phone Accessories", path: "/c/phone-accessories" },
    { name: "Cases", path: "/c/phone-accessories/cases" },
  ]
  it("links every ancestor, marks the current page, and has a mobile back link to the parent", () => {
    const html = render(h(Breadcrumbs, { crumbs }))
    expect(html).toContain('aria-label="Breadcrumb"')
    expect(html).toContain('<span aria-current="page"')
    expect(html).toContain('href="/c/phone-accessories"')
    expect(html).toMatch(/Back to <\/span>Phone Accessories/)
    expect(html).not.toContain('href="/c/phone-accessories/cases"')
  })
  it("renders nothing for a single crumb", () => {
    expect(render(h(Breadcrumbs, { crumbs: crumbs.slice(0, 1) }))).toBe("")
  })
})

describe("<FitBanner>", () => {
  it("says what it's filtering to and links to Show all (fit=all)", () => {
    const html = render(
      h(FitBanner, { ...nav(), fit: { kind: "filtered", device: "iPhone 16", total: 9 }, pickerHref: "/devices" })
    )
    expect(html).toContain("Showing items that fit your <strong")
    expect(html).toContain('href="/c/phone-accessories/cases?fit=all"')
    expect(html).toContain("Change device")
  })
  it("offers the way back when showing all", () => {
    const html = render(
      h(FitBanner, { ...nav({ fit: "all" }), fit: { kind: "all", device: "iPhone 16", fitting: 3 }, pickerHref: "/devices" })
    )
    expect(html).toContain("3 fit your")
    expect(html).toContain('href="/c/phone-accessories/cases"')
  })
  it("is hidden without a device or when nothing in scope is device-specific", () => {
    expect(render(h(FitBanner, { ...nav(), fit: { kind: "none" }, pickerHref: "/devices" }))).toBe("")
    expect(
      render(h(FitBanner, { ...nav(), fit: { kind: "not-applicable", device: "x" }, pickerHref: "/devices" }))
    ).toBe("")
  })
})

describe("<ActiveChips>", () => {
  it("each chip removes its own value; Clear all keeps sort", () => {
    const n = nav({ colour: ["black", "white"], sort: "newest", page: "2" })
    const html = render(
      h(ActiveChips, {
        ...n,
        chips: [
          { key: "colour", value: "black", label: "Colour: Black" },
          { key: "colour", value: "white", label: "Colour: White" },
        ],
      })
    )
    expect(html).toContain('href="/c/phone-accessories/cases?colour=white&amp;sort=newest"')
    expect(html).toContain('href="/c/phone-accessories/cases?colour=black&amp;sort=newest"')
    expect(html).toContain('href="/c/phone-accessories/cases?sort=newest">Clear all')
  })
})

describe("<LoadMore>", () => {
  it("links to the next page, landing on the first new item", () => {
    const html = render(h(LoadMore, { ...nav(), shown: 24, total: 60, hasMore: true }))
    expect(html).toContain("Showing 24 of 60")
    expect(html).toContain('href="/c/phone-accessories/cases?page=2#item-25"')
    expect(html).toContain('rel="next"')
  })
  it("has no button on the last page", () => {
    const html = render(h(LoadMore, { ...nav({ page: "3" }), shown: 60, total: 60, hasMore: false }))
    expect(html).toContain("Showing 60 of 60")
    expect(html).not.toContain("Load more")
  })
})

describe("<EmptyState>", () => {
  it("explains and offers Clear filters, Show all devices and Ask the shop", () => {
    const html = render(h(EmptyState, { ...nav({ colour: "pink" }), what: "cases", device: "iPhone 16", hasFilters: true }))
    expect(html).toContain("No cases for iPhone 16 with these filters")
    expect(html).toContain("Clear filters")
    expect(html).toContain('href="/c/phone-accessories/cases?fit=all">Show all devices')
    expect(html).toMatch(/href="tel:\+44\d+"/)
  })
})

describe("fit box", () => {
  const linked = [
    { id: "d1", slug: "iphone-16", model: "iPhone 16", note: "Slim case only", brand: "Apple", series: "iPhone 16", aliases: [], type: "phone" as const, release_year: 2024, image_url: null },
  ]
  it("fits / doesn't fit / choose / unknown", () => {
    expect(fitResult({ slug: "iphone-16", model: "iPhone 16" }, linked)).toEqual({ kind: "fits", device: "iPhone 16", note: "Slim case only" })
    expect(fitResult({ slug: "iphone-15", model: "iPhone 15" }, linked)).toEqual({ kind: "doesnt-fit", device: "iPhone 15" })
    expect(fitResult(null, linked)).toEqual({ kind: "choose" })
    expect(fitResult({ slug: "iphone-16", model: "iPhone 16" }, [])).toEqual({ kind: "none" })
    expect(fitResult({ slug: "iphone-16", model: "iPhone 16" }, null)).toEqual({ kind: "none" })
  })
  it("renders each state with an icon and words, never colour alone", () => {
    expect(render(h(FitBox, { status: { kind: "fits", device: "iPhone 16", note: null } }))).toContain("Fits your iPhone 16")
    const no = render(h(FitBox, { status: { kind: "doesnt-fit", device: "iPhone 16", seeHref: "/c/cases" } }))
    expect(no).toContain("Doesn&#x27;t fit your iPhone 16")
    expect(no).toContain('href="/c/cases"')
    expect(render(h(FitBox, { status: { kind: "choose", pickerHref: "/devices?returnTo=%2Fp%2Fx" } }))).toContain("choose your device")
    expect(render(h(FitBox, { status: { kind: "none" } }))).toBe("")
  })
})

describe("<DeliveryBox> and <Specs>", () => {
  it("lists Click & Collect, Standard and Next-day with prices", () => {
    const html = render(h(DeliveryBox, { lines: deliveryLines({ thresholdPence: 2000, closesToday: "8pm" }) }))
    expect(html).toContain("Click &amp; Collect: free")
    expect(html).toContain("£3.49, free on orders of £20 or more.")
    expect(html).toContain("£5.99")
  })
  it("shows plain English first, then a table with the devices it fits", () => {
    const html = render(
      h(Specs, {
        summary: ["Connects USB-C to Lightning."],
        rows: [{ label: "Connector", value: "USB-C" }],
        devices: [{ model: "iPhone 14", note: null } as never],
      })
    )
    expect(html.indexOf("In plain English")).toBeLessThan(html.indexOf("<table"))
    expect(html).toContain('<th scope="row"')
    expect(html).toContain("iPhone 14")
  })
})

describe("groupByCategory", () => {
  const cats = [
    { id: "pa", name: "Phone Accessories", handle: "phone-accessories", rank: 0, parent_category_id: null },
    { id: "cs", name: "Cases", handle: "cases", rank: 0, parent_category_id: "pa" },
    { id: "gl", name: "Screen Protectors", handle: "screen-protectors", rank: 1, parent_category_id: "pa" },
    { id: "au", name: "Audio", handle: "audio", rank: 1, parent_category_id: null },
  ]
  it("groups by the deepest category in tree order, unknown last", () => {
    const groups = groupByCategory(
      [
        { id: "a", categories: [{ id: "au" }] },
        { id: "b", categories: [{ id: "pa" }, { id: "gl" }] },
        { id: "c", categories: [{ id: "cs" }] },
        { id: "d", categories: [] },
      ],
      cats
    )
    expect(groups.map((g) => [g.category?.handle ?? null, g.products.map((p) => p.id)])).toEqual([
      ["cases", ["c"]],
      ["screen-protectors", ["b"]],
      ["audio", ["a"]],
      [null, ["d"]],
    ])
  })
})

describe("search suggestions", () => {
  it("maps hits and drops incomplete ones; price stays in major units", () => {
    expect(
      suggestionsFromHits([
        { objectID: "p1", title: "USB-C Cable", handle: "usb-c-cable", thumbnail: null, min_price_gbp: 5.99 },
        { objectID: "p2", title: "No handle" },
      ])
    ).toEqual([{ id: "p1", title: "USB-C Cable", handle: "usb-c-cable", thumbnail: null, price: 5.99 }])
  })
  it("arrow keys cycle input -> options -> input", () => {
    expect(nextActive(-1, 1, 3)).toBe(0)
    expect(nextActive(2, 1, 3)).toBe(-1)
    expect(nextActive(-1, -1, 3)).toBe(2)
    expect(nextActive(0, -1, 3)).toBe(-1)
    expect(nextActive(-1, 1, 0)).toBe(-1)
  })
})
