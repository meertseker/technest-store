import { describe, expect, it, vi } from "vitest"

// Docker/CI builds have no backend: every generateStaticParams must fall back
// to [] so pages render on demand instead of failing the build.
vi.mock("server-only", () => ({}))

const offline = () => Promise.reject(new TypeError("fetch failed"))

vi.mock("@lib/data/categories", () => ({
  listCategories: offline,
  getCategoryByHandle: offline,
}))
vi.mock("@lib/data/collections", () => ({
  listCollections: offline,
  getCollectionByHandle: offline,
}))
vi.mock("@lib/data/products", () => ({ listProducts: offline }))
vi.mock("@lib/data/regions", () => ({ getRegion: offline, listRegions: offline }))

describe("generateStaticParams without a backend", { timeout: 30_000 }, () => {
  it.each([
    ["products", () => import("../(main)/products/[handle]/page")],
    ["categories", () => import("../(main)/categories/[...category]/page")],
    ["collections", () => import("../(main)/collections/[handle]/page")],
  ])("%s returns []", async (_name, load) => {
    const mod = await load()
    await expect(mod.generateStaticParams()).resolves.toEqual([])
  })
})
