import { CORE_NAV_PATHS, coreNavSelectors, hideCoreNavCss } from "../hide-core-nav"

describe("hide-core-nav", () => {
  it("hides exactly Medusa's own menu entries, never ours", () => {
    expect(CORE_NAV_PATHS).toEqual([
      "/orders",
      "/products",
      "/collections",
      "/categories",
      "/product-options",
      "/inventory",
      "/reservations",
      "/customers",
      "/customer-groups",
      "/promotions",
      "/campaigns",
      "/price-lists",
      "/settings",
    ])
    const selectors = coreNavSelectors("/app")
    expect(selectors).toContain('a[href="/app/orders"]')
    expect(selectors).toContain('a[href="/app/settings"]')
    // Exact-match selectors only: "/app/shop-orders" must not be caught by "/orders".
    expect(selectors.every((s) => s.startsWith('a[href="/app/') && s.endsWith('"]'))).toBe(true)
    expect(selectors.some((s) => s.includes("shop-"))).toBe(false)
  })

  it("accepts a base path with a trailing slash", () => {
    expect(coreNavSelectors("/app/")).toContain('a[href="/app/orders"]')
  })

  it("builds one stylesheet that hides the items in the sidebar and the mobile menu", () => {
    const css = hideCoreNavCss("/app")
    expect(css).toContain('nav a[href="/app/orders"]')
    expect(css).toContain('aside a[href="/app/settings"]')
    expect(css).toContain('[role="dialog"] a[href="/app/products"]')
    // Scoped only: a breadcrumb or in-page link to Orders must stay visible.
    expect(css).not.toMatch(/^a\[href/m)
    expect(css).toContain("display: none !important")
    expect(css).not.toContain("/app/today")
  })

  it("hides the whole menu item, not just its link, so the phone menu's fold-out button goes too", () => {
    // Below the desktop width Medusa renders an entry with children (Products, Inventory,
    // Customers, Promotions) as a fold-out button next to the link, both inside one wrapper;
    // the link alone would leave the button and its sub-entries showing.
    const css = hideCoreNavCss("/app")
    expect(css).toContain('nav div:has(> div > a[href="/app/products"])')
    expect(css).toContain('[role="dialog"] div:has(> div > a[href="/app/customers"])')
    expect(css).toContain('aside li:has(> div > a[href="/app/inventory"])')
    // The sub-entries themselves are hidden as well, for when a native page has them open.
    expect(css).toContain('nav a[href="/app/collections"]')
    expect(css).toContain('nav a[href="/app/customer-groups"]')
  })

  it("no longer hides the layout editor button: our settings module no longer shadows Medusa's", () => {
    expect(hideCoreNavCss("/app")).not.toContain("Customize layout")
  })
})
