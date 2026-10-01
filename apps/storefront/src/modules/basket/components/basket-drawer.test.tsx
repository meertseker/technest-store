// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { HttpTypes } from "@medusajs/types"

vi.mock("@lib/data/basket-actions", () => ({ changeLineQuantity: vi.fn(), removeLine: vi.fn() }))
vi.mock("next/navigation", () => ({ usePathname: () => "/p/glass" }))

import { announceAddedToBasket } from "@lib/basket/events"
import type { BasketView } from "@lib/data/basket"
import BasketDrawer from "./basket-drawer"

const cart = {
  id: "cart_1",
  item_total: 4.99,
  total: 4.99,
  items: [
    { id: "li_1", title: "Tempered Glass", product_title: "Tempered Glass", quantity: 1, total: 4.99, unit_price: 4.99 },
  ],
} as unknown as HttpTypes.StoreCart

const view: BasketView = {
  threshold_pence: 2000,
  threshold_from_settings: true,
  addon_only: false,
  addon_rule_source: "storefront",
  choices: [],
}

afterEach(cleanup)

describe("<BasketDrawer>", () => {
  it("opens on an add and confirms it inside the drawer, above the free-delivery bar", () => {
    render(<BasketDrawer cart={cart} view={view} />)
    expect(screen.queryByRole("dialog")).toBeNull()

    act(() => announceAddedToBasket())

    const drawer = screen.getByRole("dialog", { name: "Your basket (1)" })
    const added = within(drawer).getByTestId("basket-added")
    expect(added.textContent).toBe("Added to basket")
    const bar = within(drawer).getByTestId("free-delivery")
    expect(added.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("does not say Added when the shopper just opens the basket", () => {
    render(<BasketDrawer cart={cart} view={view} />)
    fireEvent.click(screen.getByTestId("nav-cart-link"))

    const drawer = screen.getByRole("dialog", { name: "Your basket (1)" })
    expect(within(drawer).queryByTestId("basket-added")).toBeNull()
  })
})
