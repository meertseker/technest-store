import { describe, expect, it } from "vitest"
import { ACCOUNT_LINKS, isCurrent } from "./account-nav"

describe("account nav", () => {
  it("Overview is current only on /account itself", () => {
    expect(isCurrent("/account", "/account")).toBe(true)
    expect(isCurrent("/account/orders", "/account")).toBe(false)
  })

  it("sections stay current on their sub-pages", () => {
    expect(isCurrent("/account/orders/order_1", "/account/orders")).toBe(true)
    expect(isCurrent("/account/addresses/new", "/account/addresses")).toBe(true)
    expect(isCurrent("/account/ordersx", "/account/orders")).toBe(false)
  })

  it("links to the routes E2's emails use", () => {
    const hrefs = ACCOUNT_LINKS.map((l) => l.href)
    expect(hrefs).toContain("/account/orders")
    expect(hrefs).toContain("/account/trade")
  })
})
