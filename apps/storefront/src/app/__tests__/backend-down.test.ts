import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
const offline = () => Promise.reject(new TypeError("fetch failed"))
vi.mock("@lib/data/regions", () => ({ getRegion: offline, listRegions: offline }))
vi.mock("@lib/data/collections", () => ({ listCollections: offline, getCollectionByHandle: offline }))
vi.mock("@lib/data/categories", () => ({ listCategories: offline }))
vi.mock("@lib/data/products", () => ({ listProducts: offline }))
vi.mock("@lib/data/devices", () => ({
  listDevices: async () => ({ brands: [], count: 0 }),
  getCurrentDevice: offline,
}))

describe("backend down", { timeout: 30_000 }, () => {
  it("the home page still renders instead of throwing", async () => {
    const { default: Home } = await import("../(main)/page")
    const html = renderToStaticMarkup(await Home({}))
    expect(html).toContain("show products right now")
    // everything that doesn't need the backend is still there
    expect(html).toContain("Accessories that fit your phone")
    expect(html).toContain("Visit the shop")
  })

  it("the (main) error boundary keeps a friendly message and a retry button", async () => {
    const { default: ErrorPage } = await import("../(main)/error")
    const html = renderToStaticMarkup(
      createElement(ErrorPage, { error: new Error("boom"), reset: () => {} })
    )
    expect(html).toContain("Something went wrong")
    expect(html).toMatch(/<button[^>]*>Try again<\/button>/)
    expect(html).not.toContain("boom")
  })
})
