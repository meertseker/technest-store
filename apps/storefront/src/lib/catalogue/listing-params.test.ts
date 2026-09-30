import { describe, expect, it } from "vitest"
import {
  activeFilterCount,
  clearFilters,
  listingHref,
  MAX_PAGE,
  parseListingParams,
  slugify,
  toggleValue,
  withPage,
  withShowAll,
  withSort,
} from "./listing-params"

describe("slugify", () => {
  it.each([
    ["USB-C", "usb-c"],
    ["3.5mm", "3-5mm"],
    ["Chargers & Cables", "chargers-cables"],
    ["Xbox Series X|S", "xbox-series-x-s"],
    ["  Clear  ", "clear"],
    ["Galaxy S24+", "galaxy-s24-plus"],
  ])("%s -> %s", (label, slug) => expect(slugify(label)).toBe(slug))
})

describe("parseListingParams", () => {
  it("returns defaults for an empty query", () => {
    expect(parseListingParams({})).toEqual({
      filters: {},
      sort: "featured",
      page: 1,
      showAll: false,
      q: "",
    })
  })

  it("reads repeated and comma-separated facet values, de-duplicated", () => {
    const s = parseListingParams({ connector: ["usb-c", "lightning,usb-c"], colour: "black" })
    expect(s.filters).toEqual({ connector: ["usb-c", "lightning"], colour: ["black"] })
  })

  it("drops values that are not slugs and unknown keys", () => {
    const s = parseListingParams({ connector: ["<script>", "USB-C"], evil: "x" })
    expect(s.filters).toEqual({ connector: ["usb-c"] })
  })

  it("accepts known sorts only", () => {
    expect(parseListingParams({ sort: "price-asc" }).sort).toBe("price-asc")
    expect(parseListingParams({ sort: "cheapest" }).sort).toBe("featured")
    expect(parseListingParams({}, "relevance").sort).toBe("relevance")
    expect(parseListingParams({ sort: "relevance" }).sort).toBe("featured")
  })

  it("clamps the page", () => {
    expect(parseListingParams({ page: "0" }).page).toBe(1)
    expect(parseListingParams({ page: "abc" }).page).toBe(1)
    expect(parseListingParams({ page: "3" }).page).toBe(3)
    expect(parseListingParams({ page: "9999" }).page).toBe(MAX_PAGE)
  })

  it("reads fit=all and the search query", () => {
    const s = parseListingParams({ fit: "all", q: "  magsafe case " })
    expect(s.showAll).toBe(true)
    expect(s.q).toBe("magsafe case")
  })
})

describe("listingHref", () => {
  const base = parseListingParams({})

  it("leaves defaults out so each state has one URL", () => {
    expect(listingHref("/c/cases", base)).toBe("/c/cases")
  })

  it("round-trips a full state", () => {
    const state = parseListingParams({
      q: "case",
      colour: ["black", "clear"],
      price: "under-5",
      sort: "price-desc",
      fit: "all",
      page: "2",
    })
    const href = listingHref("/search", state)
    expect(href).toBe(
      "/search?q=case&colour=black&colour=clear&price=under-5&sort=price-desc&fit=all&page=2"
    )
    const qs = Object.fromEntries(
      Array.from(new URLSearchParams(href.split("?")[1]).keys()).map((k) => [
        k,
        new URLSearchParams(href.split("?")[1]).getAll(k),
      ])
    )
    expect(parseListingParams(qs)).toEqual(state)
  })

  it("omits the default sort of a search page", () => {
    const state = parseListingParams({ q: "cable" }, "relevance")
    expect(listingHref("/search", state, { defaultSort: "relevance" })).toBe("/search?q=cable")
  })
})

describe("state changes", () => {
  const start = parseListingParams({ colour: "black", page: "3" })

  it("toggling a value adds or removes it and resets the page", () => {
    const added = toggleValue(start, "colour", "white")
    expect(added.filters.colour).toEqual(["black", "white"])
    expect(added.page).toBe(1)
    const removed = toggleValue(start, "colour", "black")
    expect(removed.filters).toEqual({})
  })

  it("clear, sort and fit toggles go back to page 1", () => {
    expect(clearFilters(start)).toMatchObject({ filters: {}, page: 1 })
    expect(withSort(start, "newest")).toMatchObject({ sort: "newest", page: 1 })
    expect(withShowAll(start, true)).toMatchObject({ showAll: true, page: 1 })
    expect(withPage(start, 4).page).toBe(4)
  })

  it("counts active filters", () => {
    expect(activeFilterCount({ colour: ["a", "b"], price: ["under-5"] })).toBe(3)
  })
})
