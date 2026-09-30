import { describe, expect, it } from "vitest"
import {
  allowsAnalytics,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  consentCookieOptions,
  parseConsent,
} from "./consent"

describe("cookie consent", () => {
  it("uses the tn_consent cookie for 6 months", () => {
    expect(CONSENT_COOKIE).toBe("tn_consent")
    expect(CONSENT_MAX_AGE).toBe(15_552_000)
  })

  it.each([
    ["accepted", "accepted"],
    ["rejected", "rejected"],
    ["ACCEPTED", null],
    ["yes", null],
    ["", null],
    [undefined, null],
    [null, null],
  ])("parses %j as %j", (raw, expected) => {
    expect(parseConsent(raw)).toBe(expected)
  })

  it("allows analytics only after an explicit accept", () => {
    expect(allowsAnalytics("accepted")).toBe(true)
    expect(allowsAnalytics("rejected")).toBe(false)
    expect(allowsAnalytics(null)).toBe(false)
  })

  it("stores the choice site-wide, httpOnly, secure in production", () => {
    expect(consentCookieOptions(true)).toMatchObject({ path: "/", httpOnly: true, secure: true, sameSite: "lax" })
    expect(consentCookieOptions(false).secure).toBe(false)
  })
})
