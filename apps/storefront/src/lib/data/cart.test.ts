import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()
const createCart = vi.fn()
const createLineItem = vi.fn()
const completeCart = vi.fn()
const updateCartSdk = vi.fn()
const updateLineItemSdk = vi.fn()
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
        complete: (...a: unknown[]) => completeCart(...a),
        update: (...a: unknown[]) => updateCartSdk(...a),
        updateLineItem: (...a: unknown[]) => updateLineItemSdk(...a),
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
const captureException = vi.fn()
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => captureException(...a) }))
/** What reaches monitoring: [error, where it was handled] */
const reported = () => captureException.mock.calls.map(([error, hint]) => [error, hint?.tags?.handled_in])

import { getOrSetCart, placeOrder, retrieveCart, updateCart, updateLineItem } from "./cart"

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
  updateCartSdk.mockReset()
  updateLineItemSdk.mockReset()
  setCookie.mockReset()
  captureException.mockReset()
  vi.stubEnv("SENTRY_DSN", "https://key@example.invalid/1")
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

  it("a failed read reaches monitoring; a basket that simply does not exist does not", async () => {
    const error = httpError(503)
    backend(error)
    await retrieveCart().catch(() => {})
    expect(reported()).toEqual([[error, "basket.read"]])

    captureException.mockReset()
    backend(httpError(404))
    await retrieveCart()
    expect(reported()).toEqual([])
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

describe("a basket that is being used keeps its cookie alive", () => {
  // The cookie used to run out seven days after the basket was created, however
  // active it was; every change now renews it for another seven days.
  const renewed = () =>
    setCookie.mock.calls.filter(([name]) => name === "_medusa_cart_id").map(([, value, options]) => ({ value, options }))

  it("changing a quantity", async () => {
    updateLineItemSdk.mockResolvedValue({ cart: { id: "cart_old" } })
    await updateLineItem({ lineId: "li_1", quantity: 2 })
    expect(renewed()).toEqual([{ value: "cart_old", options: expect.objectContaining({ maxAge: 60 * 60 * 24 * 7, httpOnly: true }) }])
  })

  it("saving an address or email", async () => {
    updateCartSdk.mockResolvedValue({ cart: { id: "cart_old" } })
    await updateCart({ email: "sam@example.com" })
    expect(renewed()).toHaveLength(1)
  })

  it("not when the backend refused the change", async () => {
    updateLineItemSdk.mockRejectedValue(httpError(400))
    await expect(updateLineItem({ lineId: "li_1", quantity: 99 })).rejects.toMatchObject({ status: 400 })
    expect(renewed()).toEqual([])
  })
})

describe("placeOrder", () => {
  beforeEach(() => {
    completeCart.mockReset()
    completeCart.mockResolvedValue({ type: "order", order: { id: "order_1" } })
  })

  it("forgets the basket cookie once that basket has become an order", async () => {
    await placeOrder("cart_old")
    expect(setCookie).toHaveBeenCalledWith("_medusa_cart_id", "", expect.objectContaining({ maxAge: -1 }))
  })

  it("remembers the new order so the confirmation page can show it in full", async () => {
    await placeOrder("cart_old")
    expect(setCookie).toHaveBeenCalledWith("_technest_order", "order_1", expect.objectContaining({ httpOnly: true }))
  })

  it("keeps the cookie when a different basket was completed", async () => {
    await placeOrder("cart_someone_elses")
    expect(setCookie).not.toHaveBeenCalledWith("_medusa_cart_id", "", expect.anything())
    expect(jar._medusa_cart_id).toBe("cart_old")
  })
})

// The backend answers 200 with the cart (not an order) when the payment step
// itself refused, so the callers can word the outcome honestly.
describe("placeOrder when the payment was never authorised", () => {
  const refusal = (type: string, extra: Record<string, unknown> = {}) => ({
    type: "cart",
    cart: { id: "cart_old" },
    error: { message: "Payment authorization failed", name: "Error", type, ...extra },
  })

  it("throws a refusal marked as not authorised, without a confirmation redirect", async () => {
    completeCart.mockResolvedValue(refusal("payment_authorization_error"))
    await expect(placeOrder("cart_old")).rejects.toMatchObject({ payment_not_authorised: true })
    completeCart.mockResolvedValue(refusal("payment_requires_more_error"))
    await expect(placeOrder("cart_old")).rejects.toMatchObject({ payment_not_authorised: true })
    expect(setCookie).not.toHaveBeenCalledWith("_technest_order", expect.anything(), expect.anything())
  })

  it("a refusal that released the hold keeps its own mark", async () => {
    completeCart.mockResolvedValue(refusal("not_allowed", { payment_released: true }))
    await expect(placeOrder("cart_old")).rejects.toMatchObject({ payment_released: true })
  })
})
