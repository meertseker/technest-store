import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()
const createCart = vi.fn()
const createLineItem = vi.fn()
const setCookie = vi.fn()
const jar: Record<string, string> = {}

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  sdk: {
    client: { fetch: (...a: unknown[]) => fetchMock(...a) },
    store: {
      cart: {
        create: (...a: unknown[]) => createCart(...a),
        createLineItem: (...a: unknown[]) => createLineItem(...a),
        update: vi.fn(),
      },
    },
  },
}))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar[name] ? { value: jar[name] } : undefined),
    set: (name: string, value: string, options?: unknown) => {
      setCookie(name, value, options)
      jar[name] = value
    },
  }),
}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

import { getOrSetCart, retrieveCart } from "./cart"

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status })
const region = { regions: [{ id: "reg_1", countries: [{ iso_2: "gb" }] }] }

/** Backend stub: regions always answer; the cart answers with `cart` (a value or an error) */
function backend(cart: unknown) {
  fetchMock.mockImplementation(async (path: string) => {
    if (path.includes("/store/regions")) return region
    if (cart instanceof Error) throw cart
    return { cart }
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  createCart.mockReset()
  createLineItem.mockReset()
  setCookie.mockReset()
  for (const k of Object.keys(jar)) delete jar[k]
  jar._medusa_cart_id = "cart_old"
  createCart.mockResolvedValue({ cart: { id: "cart_new", region_id: "reg_1" } })
})

describe("retrieveCart", () => {
  it("returns the basket", async () => {
    backend({ id: "cart_old", items: [{ id: "li_1" }] })
    await expect(retrieveCart()).resolves.toMatchObject({ id: "cart_old" })
  })

  it("is null without a basket cookie, and asks the backend nothing", async () => {
    delete jar._medusa_cart_id
    await expect(retrieveCart()).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("is null when the backend says the basket does not exist", async () => {
    backend(httpError(404))
    await expect(retrieveCart()).resolves.toBeNull()
  })

  it.each([500, 502, 503])("throws on a %i instead of pretending the basket is empty", async (status) => {
    backend(httpError(status))
    await expect(retrieveCart()).rejects.toMatchObject({ status })
  })

  it("throws when the backend cannot be reached", async () => {
    backend(new TypeError("fetch failed"))
    await expect(retrieveCart()).rejects.toThrow("fetch failed")
  })

  it("is null for a basket that has already become an order", async () => {
    backend({ id: "cart_old", completed_at: "2026-10-06T10:00:00Z", items: [{ id: "li_1" }] })
    await expect(retrieveCart()).resolves.toBeNull()
  })

  it("still returns a completed basket to the code that finishes the order", async () => {
    backend({ id: "cart_old", completed_at: "2026-10-06T10:00:00Z", items: [{ id: "li_1" }] })
    await expect(retrieveCart(undefined, undefined, { includeCompleted: true })).resolves.toMatchObject({
      id: "cart_old",
    })
  })
})

describe("getOrSetCart", () => {
  it("keeps the basket it finds", async () => {
    backend({ id: "cart_old", region_id: "reg_1" })
    await expect(getOrSetCart("gb")).resolves.toMatchObject({ id: "cart_old" })
    expect(createCart).not.toHaveBeenCalled()
    expect(setCookie).not.toHaveBeenCalled()
  })

  it("starts a new basket when the old one has become an order", async () => {
    backend({ id: "cart_old", region_id: "reg_1", completed_at: "2026-10-06T10:00:00Z" })
    await expect(getOrSetCart("gb")).resolves.toMatchObject({ id: "cart_new" })
    expect(setCookie).toHaveBeenCalledWith("_medusa_cart_id", "cart_new", expect.anything())
  })

  it("starts a new basket when the old one no longer exists", async () => {
    backend(httpError(404))
    await expect(getOrSetCart("gb")).resolves.toMatchObject({ id: "cart_new" })
    expect(jar._medusa_cart_id).toBe("cart_new")
  })

  it("does not replace the shopper's basket when the backend has a bad moment", async () => {
    backend(httpError(503))
    await expect(getOrSetCart("gb")).rejects.toMatchObject({ status: 503 })
    expect(createCart).not.toHaveBeenCalled()
    expect(setCookie).not.toHaveBeenCalled()
    expect(jar._medusa_cart_id).toBe("cart_old")
  })
})
