// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// jsdom cannot navigate: keep the link's own onClick, drop the page load
vi.mock("next/link", () => ({
  default: ({ onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      onClick={(e) => {
        e.preventDefault()
        onClick?.(e)
      }}
    />
  ),
}))

import type { ShopMenuGroup } from "@/lib/layout/menu"
import SideMenu from "."

const groups: ShopMenuGroup[] = [
  {
    name: "Phone Accessories",
    href: "/c/phone-accessories",
    children: [{ name: "Cases", href: "/c/phone-accessories/cases" }],
  },
  { name: "£1 Deals", href: "/c/1-deals", children: [] },
]

afterEach(cleanup)

const openMenu = () => {
  fireEvent.click(screen.getByRole("button", { name: "Menu" }))
  return screen.getByRole("dialog", { name: "Menu" })
}

describe("<SideMenu>", () => {
  it("lists every category and subcategory, so the whole shop is one tap away", () => {
    render(<SideMenu groups={groups} />)
    const menu = within(openMenu())
    const hrefs = Object.fromEntries(
      menu.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])
    )
    expect(hrefs).toEqual({
      Home: "/",
      "All products": "/search",
      "Phone Accessories": "/c/phone-accessories",
      Cases: "/c/phone-accessories/cases",
      "£1 Deals": "/c/1-deals",
      Repairs: "/repairs",
      Trade: "/trade",
      Account: "/account",
      "Contact us": "/contact",
    })
  })

  it("never puts the basket inside the menu (it stays in the header)", () => {
    render(<SideMenu groups={groups} />)
    expect(within(openMenu()).queryByRole("link", { name: /basket/i })).toBeNull()
  })

  it("closes when a link is chosen", () => {
    render(<SideMenu groups={groups} />)
    fireEvent.click(within(openMenu()).getByRole("link", { name: "Cases" }))
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
