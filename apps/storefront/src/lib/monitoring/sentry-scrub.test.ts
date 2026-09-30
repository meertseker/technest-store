import { describe, expect, it } from "vitest"
import { scrubEvent, scrubText, shouldInitBrowserSentry } from "./sentry-scrub"

describe("scrubText", () => {
  it("redacts PII and secrets", () => {
    const out = scrubText("a.b@example.com 07775 669000 SE16 3TU pi_1_secret_x 4242 4242 4242 4242")
    expect(out).toBe("[email] [phone] [postcode] [secret] [card]")
  })
})

describe("scrubEvent", () => {
  it("keeps only the user id and strips cookies, bodies and query strings", () => {
    const out = scrubEvent({
      user: { id: "cus_1", email: "x@y.co" },
      request: { url: "https://technest.co.uk/account?email=x@y.co", cookies: { a: "b" }, data: "{}" },
    } as any)
    expect(out.user).toEqual({ id: "cus_1" })
    expect(out.request).toEqual({ url: "https://technest.co.uk/account" })
  })
})

describe("shouldInitBrowserSentry", () => {
  it("never on /checkout (only Stripe's script is allowed there)", () => {
    expect(shouldInitBrowserSentry("dsn", "/checkout")).toBe(false)
    expect(shouldInitBrowserSentry("dsn", "/checkout/review")).toBe(false)
  })
  it("only with a DSN", () => {
    expect(shouldInitBrowserSentry(undefined, "/")).toBe(false)
    expect(shouldInitBrowserSentry("dsn", "/")).toBe(true)
    expect(shouldInitBrowserSentry("dsn", "/checkouts-guide")).toBe(true)
  })
})
