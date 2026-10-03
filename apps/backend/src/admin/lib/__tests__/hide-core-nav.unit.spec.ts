import { CORE_NAV_PATHS, coreNavSelectors, hideCoreNavCss } from "../hide-core-nav"

describe("hide-core-nav", () => {
  it("hides exactly Medusa's own menu entries, never ours", () => {
    expect(CORE_NAV_PATHS).toEqual([
      "/orders",
      "/products",
      "/inventory",
      "/customers",
      "/promotions",
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
})
