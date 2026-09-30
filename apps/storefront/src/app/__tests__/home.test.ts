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
    const order = [
      "Accessories that fit your phone",
      "Why shop with us",
      "Shop by category",
      "£1 Deals and under £5",
      "New in",
      "Screen broken? Most repairs same day",
      "on Google · ",
      "Visit the shop",
      "Buying for a business?",
    ].map((s) => html.indexOf(s))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(html).not.toMatch(/Medusa|Starter Template|GitHub/i)
  })

  it("uses only real Tech Nest photos, with priority on the hero photo alone", async () => {
    const html = await render()
    const imgs = html.match(/<img[^>]*>/g) ?? []
    const srcs = imgs.map((i) => decodeURIComponent(i.match(/src="([^"]+)"/)?.[1] ?? ""))
    for (const s of srcs) expect(s).toMatch(/\/images\/shop\/(controller-wall|interior-wide|shopfront|aisle-accessories)\.jpg/)
    const eager = imgs.filter((i) => !/loading="lazy"/.test(i))
    expect(eager).toHaveLength(1)
    expect(eager[0]).toContain("controller-wall")
    expect(eager[0]).toMatch(/fetchPriority="high"/i)
  })

  it("category tiles come from the backend, without the £1 range", async () => {
    const html = await render()
    expect(html).toContain('href="/c/phone-accessories/cases"')
    expect(html).not.toContain('href="/c/1-deals"><div')
  })

  it("deals tabs: £1 by default, Under £5 from ?deals=under-5, prices not divided", async () => {
    const one = await render()
    expect(one).toContain('aria-current="page" class')
    expect(one).toContain("Product cloth")
    expect(one).toContain("£1 add-on")
    const under = await render({ deals: "under-5" })
    expect(under).toContain("Product lens")
    expect(under).toContain("£3.99")
    expect(under).not.toContain("Product cloth")
  })

  it("shows curated best sellers when the collection exists", async () => {
    state.bestSellers = { id: "pcol_best" }
    const html = await render()
    state.bestSellers = null
    expect(html).toContain("Best sellers")
    expect(html).toContain("Product charger")
    expect(html).not.toContain(">New in<")
  })
})
