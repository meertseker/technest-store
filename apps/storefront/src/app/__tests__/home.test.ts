import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { MOCK_DEVICE_TREE } from "@/lib/devices/mock"

vi.mock("server-only", () => ({}))

const price = (n: number) => [{ calculated_price: { calculated_amount: n, currency_code: "gbp" } }]
const product = (id: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Product ${id}`,
  handle: id,
  thumbnail: null,
  created_at: "2026-09-01T00:00:00Z",
  collection_id: null,
  metadata: {},
  categories: [],
  variants: price(amount),
  ...extra,
})
const PRODUCTS = [
  product("cloth", 1, { metadata: { is_addon_item: true } }),
  product("lens", 3.99),
  product("case", 9.99, { created_at: "2026-09-20T00:00:00Z" }),
  product("charger", 29.99, { collection_id: "pcol_best" }),
]
const CATEGORIES = [
  { id: "phone", name: "Phone Accessories", handle: "phone-accessories", rank: 0, parent_category_id: null },
  { id: "cases", name: "Cases", handle: "cases", rank: 0, parent_category_id: "phone" },
  { id: "deals", name: "£1 Deals", handle: "1-deals", rank: 4, parent_category_id: null },
]
const state = vi.hoisted(() => ({ bestSellers: null as null | { id: string } }))

vi.mock("@lib/data/regions", () => ({ getRegion: async () => ({ id: "reg_gb" }) }))
vi.mock("@lib/data/products", () => ({
  listProducts: async () => ({ response: { products: PRODUCTS, count: PRODUCTS.length } }),
}))
vi.mock("@lib/data/categories", () => ({ listCategories: async () => CATEGORIES }))
vi.mock("@lib/data/collections", () => ({
  getCollectionByHandle: async () => state.bestSellers,
}))
vi.mock("@lib/data/devices", () => ({
  listDevices: async () => MOCK_DEVICE_TREE,
  getCurrentDevice: async () => null,
}))

const render = async (sp: Record<string, string> = {}) => {
  const { default: Home } = await import("../(main)/page")
  return renderToStaticMarkup(await Home({ searchParams: Promise.resolve(sp) }))
}
const count = (html: string, needle: string) => html.split(needle).length - 1

describe("home page", { timeout: 30_000 }, () => {
  it("has one H1, the spec's sections in order, and no starter content", async () => {
    const html = await render()
    expect(count(html, "<h1")).toBe(1)
    // the page opens on the department cards; nothing but the hidden H1 sits above them (2026-10-29)
    expect(html.indexOf("Shop now")).toBeLessThan(html.indexOf("Your phone or console"))
    const order = [
      "Accessories that fit your phone",
      "New in",
      "Why shop with us",
      "Shop by category",
      "Screen broken? Most repairs are done the same day.",
      "on Google from ",
      "Visit the shop",
      "Buying for a business?",
    ].map((s) => html.indexOf(s))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(html).not.toMatch(/Medusa|Starter Template|GitHub/i)
  })

  it("uses our own photos (plus the repair-bench picture); only the department cards load eagerly", async () => {
    const html = await render()
    const imgs = html.match(/<img[^>]*>/g) ?? []
    expect(imgs.length).toBeGreaterThan(0)
    const srcs = imgs.map((i) => decodeURIComponent(i.match(/src="([^"]+)"/)?.[1] ?? ""))
    for (const s of srcs)
      expect(s).toMatch(
        /\/images\/(shop\/(controller-wall|interior-wide|interior-audio|case-wall|shopfront|aisle-accessories)|repair\/bench)\.jpg/
      )
    // the page opens on the department cards (2026-10-29), so their photos are the LCP and load eagerly;
    // everything further down stays lazy
    const eager = imgs.filter((i) => !/loading="lazy"/.test(i))
    expect(eager.length).toBeGreaterThan(0)
    expect(eager.length).toBeLessThanOrEqual(4)
    for (const i of eager)
      expect(decodeURIComponent(i.match(/src="([^"]+)"/)?.[1] ?? "")).toMatch(/\/images\/shop\/(case-wall|interior-audio|controller-wall|aisle-accessories)\.jpg/)
    expect(srcs.some((s) => s.includes("/images/repair/bench.jpg"))).toBe(true)
  })

  it("category tiles come from the backend, without the £1 range", async () => {
    const html = await render()
    expect(html).toContain('href="/c/phone-accessories/cases"')
    expect(html).not.toContain('href="/c/1-deals"><div')
  })

  // The "£1 Deals" category itself is switched off in the admin, so menus drop it there.
  it("has no £1 range: no deals section, and New in leaves £1 add-ons out", async () => {
    const html = await render({ deals: "one-pound" })
    expect(html).not.toContain("£1 deals")
    expect(html).not.toContain("Product cloth")
    expect(html).toContain("Product lens")
  })

  it("shows curated best sellers when the collection exists", async () => {
    state.bestSellers = { id: "pcol_best" }
    const html = await render()
    state.bestSellers = null
    expect(html).toContain("Best sellers")
    expect(html).toContain("Product charger")
    // New in sits under the hero whether or not the shop picked best sellers.
    expect(html).toContain(">New in<")
  })
})
