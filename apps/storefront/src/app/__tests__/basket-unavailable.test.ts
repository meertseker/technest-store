import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const retrieveCart = vi.fn()
const retrieveCustomer = vi.fn()
const redirect = vi.fn((to: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { to })
})

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to), unstable_rethrow: vi.fn() }))
vi.mock("@lib/data/cart", () => ({ retrieveCart: (...a: unknown[]) => retrieveCart(...a) }))
vi.mock("@lib/data/customer", () => ({ retrieveCustomer: (...a: unknown[]) => retrieveCustomer(...a) }))
vi.mock("@lib/data/basket", () => ({
  CHECKOUT_CART_FIELDS: "*items",
  getBasketView: async () => ({ threshold_pence: 2000, addon_only: false, choices: [] }),
}))

const backendDown = () => Promise.reject(Object.assign(new Error("Service Unavailable"), { status: 503 }))

beforeEach(() => {
  retrieveCart.mockReset()
  retrieveCustomer.mockReset()
  redirect.mockClear()
  retrieveCustomer.mockResolvedValue(null)
})

describe("the backend cannot answer for the basket", { timeout: 30_000 }, () => {
  it("/basket says it could not load the basket, not that the basket is empty", async () => {
    retrieveCart.mockImplementation(backendDown)
    const { default: BasketPage } = await import("../(main)/basket/page")
    const html = renderToStaticMarkup(await BasketPage({ searchParams: Promise.resolve({}) }))
    expect(html).toContain("load your basket")
    expect(html).toContain('href="/basket"')
    expect(html).not.toContain("Your basket is empty")
  })

  it("/basket still shows the empty basket when there really is none", async () => {
    retrieveCart.mockResolvedValue(null)
    const { default: BasketPage } = await import("../(main)/basket/page")
    const html = renderToStaticMarkup(await BasketPage({ searchParams: Promise.resolve({}) }))
    expect(html).toContain("Your basket is empty")
    expect(html).not.toContain("load your basket")
  })

  it("/checkout fails into its error page instead of sending the shopper to an empty basket", async () => {
    retrieveCart.mockImplementation(backendDown)
    const { default: Checkout } = await import("../(checkout)/checkout/page")
    await expect(Checkout({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({ status: 503 })
    expect(redirect).not.toHaveBeenCalled()
  })

  it("/checkout without a basket goes to /basket", async () => {
    retrieveCart.mockResolvedValue(null)
    const { default: Checkout } = await import("../(checkout)/checkout/page")
    await expect(Checkout({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({ to: "/basket" })
  })
})
