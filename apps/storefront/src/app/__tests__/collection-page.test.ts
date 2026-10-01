import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND")
  },
  usePathname: () => "/collections/best-sellers",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const getCollectionByHandle = vi.fn()
vi.mock("@lib/data/collections", () => ({
  getCollectionByHandle: (...a: unknown[]) => getCollectionByHandle(...a),
}))
vi.mock("@lib/data/devices", () => ({ getCurrentDevice: async () => null }))
const listCollectionProducts = vi.fn()
vi.mock("@lib/data/catalogue", () => ({
  listCollectionProducts: (...a: unknown[]) => listCollectionProducts(...a),
  listDeviceProductIds: async () => null,
}))
vi.mock("@lib/data/cart", () => ({ addToCart: vi.fn() }))

import { product } from "@/lib/catalogue/test-fixtures"
import * as page from "../(main)/collections/[handle]/page"

const props = (handle: string) => ({
  params: Promise.resolve({ handle }),
  searchParams: Promise.resolve({}),
})

beforeEach(() => {
  getCollectionByHandle.mockReset()
  listCollectionProducts.mockReset()
})

describe("/collections/[handle]", () => {
  it("is a 404 for a collection that does not exist", async () => {
    getCollectionByHandle.mockResolvedValue(null)
    await expect(page.default(props("nope"))).rejects.toThrow("NEXT_NOT_FOUND")
    await expect(page.generateMetadata(props("nope"))).rejects.toThrow("NEXT_NOT_FOUND")
  })

  it("is titled with the collection's own name (the site name comes from the layout)", async () => {
    getCollectionByHandle.mockResolvedValue({ id: "col_1", handle: "best-sellers", title: "Best sellers" })
    const meta = await page.generateMetadata(props("best-sellers"))
    expect(meta.title).toBe("Best sellers")
    expect(meta.alternates?.canonical).toBe("/collections/best-sellers")
  })

  it("lists the collection's products with the shop's own cards", async () => {
    getCollectionByHandle.mockResolvedValue({ id: "col_1", handle: "best-sellers", title: "Best sellers" })
    listCollectionProducts.mockResolvedValue({
      products: [product({ id: "glass", title: "Tempered Glass", handle: "tempered-glass" })],
      count: 1,
    })
    const html = renderToStaticMarkup(await page.default(props("best-sellers")))
    expect(listCollectionProducts).toHaveBeenCalledWith("col_1")
    expect(html).toMatch(/<h1[^>]*>Best sellers/)
    expect(html).toContain('href="/p/tempered-glass"')
    expect(html).not.toContain("/products/")
  })

  it("renders on demand: no build-time list of collections that would need the backend", () => {
    expect("generateStaticParams" in page).toBe(false)
  })
})
