import { describe, expect, it } from "vitest"
import { buildSitemap, PRIVATE_PATHS, STATIC_PATHS } from "./sitemap"
import robots from "@/app/robots"

const empty = { products: [], categories: [], collections: [] }

describe("buildSitemap", () => {
  it("lists the static pages with the home page first", () => {
    const urls = buildSitemap("https://technest.co.uk/", empty).map((e) => e.url)
    expect(urls[0]).toBe("https://technest.co.uk")
    for (const p of STATIC_PATHS.filter((p) => p !== "/")) {
      expect(urls).toContain(`https://technest.co.uk${p}`)
    }
  })

  it("leaves draft legal pages out", () => {
    const urls = buildSitemap("https://technest.co.uk", empty).map((e) => e.url)
    expect(urls.some((u) => u.includes("/legal/"))).toBe(false)
  })

  it("adds products, categories and collections with lastModified", () => {
    const map = buildSitemap("https://technest.co.uk", {
      products: [{ handle: "usb-c-cable-1m", updated_at: "2026-09-01T10:00:00Z" }],
      categories: [{ handle: "chargers-cables" }],
      collections: [{ handle: "one-pound-deals", updated_at: null }],
    })
    const product = map.find((e) => e.url.endsWith("/products/usb-c-cable-1m"))
    expect(product?.lastModified).toEqual(new Date("2026-09-01T10:00:00Z"))
    expect(product?.priority).toBe(0.8)
    expect(map.some((e) => e.url === "https://technest.co.uk/categories/chargers-cables")).toBe(true)
    expect(map.some((e) => e.url === "https://technest.co.uk/collections/one-pound-deals")).toBe(true)
  })

  it("skips handles that are not URL-safe", () => {
    const map = buildSitemap("https://technest.co.uk", {
      ...empty,
      products: [{ handle: "" }, { handle: "../x" }, { handle: "<script>" }, { handle: "ok-one" }],
    })
    expect(map.filter((e) => e.url.includes("/products/")).map((e) => e.url)).toEqual([
      "https://technest.co.uk/products/ok-one",
    ])
  })

  it("never lists private paths", () => {
    const map = buildSitemap("https://technest.co.uk", empty)
    for (const p of PRIVATE_PATHS) {
      expect(map.some((e) => new URL(e.url).pathname.startsWith(p))).toBe(false)
    }
  })
})

describe("robots", () => {
  it("allows the shop, blocks checkout/basket/account, and points to the sitemap", () => {
    const r = robots()
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules
    expect(rule.allow).toBe("/")
    expect(rule.disallow).toEqual(expect.arrayContaining(["/checkout", "/cart", "/account", "/api/"]))
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/)
  })
})
