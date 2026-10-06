import { describe, expect, it } from "vitest"
import { MAX_SESSION_SECONDS, UNKNOWN_EXPIRY_SECONDS, authCookieMaxAge, isTokenExpired } from "./session"

const NOW = Date.UTC(2026, 9, 6, 12, 0, 0)
const nowSeconds = NOW / 1000

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
/** A token shaped like the backend's (header.payload.signature); the signature is never checked here */
const jwt = (payload: Record<string, unknown>) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.sig`

describe("authCookieMaxAge", () => {
  it("the sign-in cookie lasts as long as the backend's token, less a minute", () => {
    const oneDay = jwt({ actor_id: "cus_1", exp: nowSeconds + 86_400 })
    expect(authCookieMaxAge(oneDay, NOW)).toBe(86_400 - 60)
  })

  it("follows a longer backend setting, but never beyond 7 days", () => {
    expect(authCookieMaxAge(jwt({ exp: nowSeconds + 3 * 86_400 }), NOW)).toBe(3 * 86_400 - 60)
    expect(authCookieMaxAge(jwt({ exp: nowSeconds + 30 * 86_400 }), NOW)).toBe(MAX_SESSION_SECONDS)
    expect(MAX_SESSION_SECONDS).toBe(7 * 86_400)
  })

  it("a token without an expiry gets the longest cookie", () => {
    expect(authCookieMaxAge(jwt({ actor_id: "cus_1" }), NOW)).toBe(MAX_SESSION_SECONDS)
  })

  it("a token that cannot be read gets the backend's default lifetime", () => {
    expect(authCookieMaxAge("not-a-jwt", NOW)).toBe(UNKNOWN_EXPIRY_SECONDS)
    expect(authCookieMaxAge("a.b.c", NOW)).toBe(UNKNOWN_EXPIRY_SECONDS)
    expect(UNKNOWN_EXPIRY_SECONDS).toBe(86_400)
  })

  it("an already expired token gets no cookie time", () => {
    expect(authCookieMaxAge(jwt({ exp: nowSeconds - 10 }), NOW)).toBe(0)
    expect(authCookieMaxAge(jwt({ exp: nowSeconds + 30 }), NOW)).toBe(0)
  })
})

describe("isTokenExpired", () => {
  it("is true only when the token says so itself", () => {
    expect(isTokenExpired(jwt({ exp: nowSeconds - 1 }), NOW)).toBe(true)
    expect(isTokenExpired(jwt({ exp: nowSeconds + 60 }), NOW)).toBe(false)
    expect(isTokenExpired(jwt({ actor_id: "cus_1" }), NOW)).toBe(false)
    // unreadable: let the backend decide
    expect(isTokenExpired("not-a-jwt", NOW)).toBe(false)
  })
})
