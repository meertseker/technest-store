// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const retrieveCart = vi.fn()
const getBasketView = vi.fn()

vi.mock("@lib/data/cart", () => ({ retrieveCart: (...a: unknown[]) => retrieveCart(...a) }))
vi.mock("@lib/data/basket", () => ({ getBasketView: (...a: unknown[]) => getBasketView(...a) }))
vi.mock("@modules/basket/components/basket-drawer", () => ({
  default: ({ cart }: { cart: { id: string } | null }) => <div>drawer for {cart?.id ?? "no cart"}</div>,
}))

import { redirect } from "next/navigation"
import CartButton from "./index"

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// CartButton renders in the header without a Suspense boundary, so it must never throw.
describe("CartButton", () => {
  it("renders the basket drawer with the cart and its view", async () => {
    retrieveCart.mockResolvedValue({ id: "cart_1" })
    getBasketView.mockResolvedValue({})

    render(await CartButton())

    expect(screen.getByText("drawer for cart_1")).toBeTruthy()
  })

  it("renders a plain Basket link when the basket data can't be built", async () => {
    retrieveCart.mockResolvedValue({ id: "cart_1" })
    getBasketView.mockRejectedValue(new Error("backend down"))

    render(await CartButton())

    expect(screen.getByRole("link", { name: "Basket" }).getAttribute("href")).toBe("/basket")
  })

  it("renders the plain Basket link, not an empty basket, when the cart can't be read", async () => {
    retrieveCart.mockRejectedValue(new Error("backend down"))
    getBasketView.mockResolvedValue({})

    render(await CartButton())

    expect(screen.getByRole("link", { name: "Basket" }).getAttribute("href")).toBe("/basket")
    expect(screen.queryByText(/drawer for/)).toBeNull()
  })

  it("renders the drawer with no cart when there is no basket", async () => {
    retrieveCart.mockResolvedValue(null)
    getBasketView.mockResolvedValue({})

    render(await CartButton())

    expect(screen.getByText("drawer for no cart")).toBeTruthy()
  })

  // redirect(), notFound() and the dynamic-rendering bailout are thrown errors Next must see.
  it("lets Next's own control-flow errors through", async () => {
    retrieveCart.mockResolvedValue({ id: "cart_1" })
    getBasketView.mockImplementation(async () => redirect("/elsewhere"))

    await expect(CartButton()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") })
  })
})
