// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

let pathname = "/"
vi.mock("next/navigation", () => ({ usePathname: () => pathname }))
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
import MainNav from "."

const groups: ShopMenuGroup[] = [
  {
    name: "Phone Accessories",
    href: "/c/phone-accessories",
    children: [{ name: "Cases", href: "/c/phone-accessories/cases" }],
  },
  { name: "£1 Deals", href: "/c/1-deals", children: [] },
]

afterEach(() => {
  cleanup()
  pathname = "/"
})

describe("<MainNav>", () => {
  it("keeps the categories closed until Shop is pressed", () => {
    render(<MainNav groups={groups} />)
    const shop = screen.getByRole("button", { name: "Shop" })
    expect(shop.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("link", { name: "Cases" })).toBeNull()

    fireEvent.click(shop)

    expect(shop.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByRole("link", { name: "Cases" }).getAttribute("href")).toBe("/c/phone-accessories/cases")
    expect(screen.getByRole("link", { name: "Phone Accessories" }).getAttribute("href")).toBe("/c/phone-accessories")
    expect(screen.getByRole("link", { name: "£1 Deals" }).getAttribute("href")).toBe("/c/1-deals")
    expect(screen.getByRole("link", { name: "All products" }).getAttribute("href")).toBe("/search")
  })

  it("closes on Escape and gives focus back to Shop", () => {
    render(<MainNav groups={groups} />)
    const shop = screen.getByRole("button", { name: "Shop" })
    fireEvent.click(shop)
    screen.getByRole("link", { name: "Cases" }).focus()

    fireEvent.keyDown(document.activeElement!, { key: "Escape" })

    expect(screen.queryByRole("link", { name: "Cases" })).toBeNull()
    expect(document.activeElement).toBe(shop)
  })

  it("closes when a category is chosen", () => {
    render(<MainNav groups={groups} />)
    fireEvent.click(screen.getByRole("button", { name: "Shop" }))
    fireEvent.click(screen.getByRole("link", { name: "Cases" }))
    expect(screen.queryByRole("link", { name: "Cases" })).toBeNull()
  })

  it("always offers Repairs and Trade, and marks the section you are in", () => {
    pathname = "/repairs/book"
    render(<MainNav groups={groups} />)
    expect(screen.getByRole("link", { name: "Repairs" }).getAttribute("aria-current")).toBe("true")
    expect(screen.getByRole("link", { name: "Trade" }).getAttribute("aria-current")).toBeNull()
    expect(screen.getByRole("link", { name: "Trade" }).getAttribute("href")).toBe("/trade")
  })

  it("links Shop straight to all products when there are no categories to show", () => {
    render(<MainNav groups={[]} />)
    expect(screen.queryByRole("button", { name: "Shop" })).toBeNull()
    expect(screen.getByRole("link", { name: "Shop" }).getAttribute("href")).toBe("/search")
  })
})
