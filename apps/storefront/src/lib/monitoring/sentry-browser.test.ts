import { afterEach, describe, expect, it, vi } from "vitest"
import { browserBeforeBreadcrumb, browserBeforeSend, shouldInitBrowserSentry } from "./sentry-browser"

describe("shouldInitBrowserSentry", () => {
  it("never on /checkout (only Stripe's script is allowed there)", () => {
    expect(shouldInitBrowserSentry("dsn", "/checkout")).toBe(false)
    expect(shouldInitBrowserSentry("dsn", "/checkout/review")).toBe(false)
  })
  it("only with a DSN", () => {
    expect(shouldInitBrowserSentry(undefined, "/")).toBe(false)
    expect(shouldInitBrowserSentry("", "/")).toBe(false)
    expect(shouldInitBrowserSentry("dsn", "/")).toBe(true)
    expect(shouldInitBrowserSentry("dsn", "/checkouts-guide")).toBe(true)
  })
})

describe("browser hooks", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("drop every event and breadcrumb while the page is on /checkout", () => {
    vi.stubGlobal("window", { location: { pathname: "/checkout" } })
    expect(browserBeforeSend({ message: "x" })).toBeNull()
    expect(browserBeforeBreadcrumb({ message: "x" })).toBeNull()
  })

  it("scrub events elsewhere", () => {
    vi.stubGlobal("window", { location: { pathname: "/cart" } })
    expect(browserBeforeSend({ message: "for a@b.co" })).toEqual({ message: "for [email]" })
    expect(browserBeforeBreadcrumb({ message: "a@b.co" })).toEqual({ message: "[email]" })
  })
})
