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

  it("treats a failed cart fetch as no cart", async () => {
    retrieveCart.mockRejectedValue(new Error("backend down"))
    getBasketView.mockResolvedValue({})

    render(await CartButton())

    expect(screen.getByText("drawer for no cart")).toBeTruthy()
  })
})
