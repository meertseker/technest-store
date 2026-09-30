import { describe, expect, it } from "vitest"
import { isSameOriginRequest } from "./same-origin"

const h = (init: Record<string, string>) => new Headers(init)

describe("isSameOriginRequest", () => {
  it("trusts Fetch Metadata when present", () => {
    expect(isSameOriginRequest(h({ "sec-fetch-site": "same-origin" }))).toBe(true)
    expect(isSameOriginRequest(h({ "sec-fetch-site": "none" }))).toBe(true)
    expect(isSameOriginRequest(h({ "sec-fetch-site": "cross-site", origin: "http://shop.test", host: "shop.test" }))).toBe(false)
    expect(isSameOriginRequest(h({ "sec-fetch-site": "same-site" }))).toBe(false)
  })
  it("falls back to Origin vs Host (or the proxy's forwarded host)", () => {
    expect(isSameOriginRequest(h({ origin: "http://localhost:8003", host: "localhost:8003" }))).toBe(true)
    expect(isSameOriginRequest(h({ origin: "https://evil.example", host: "localhost:8003" }))).toBe(false)
    expect(
      isSameOriginRequest(h({ origin: "https://technest.example", host: "storefront:8000", "x-forwarded-host": "technest.example" }))
    ).toBe(true)
    expect(isSameOriginRequest(h({ origin: "null", host: "localhost:8003" }))).toBe(false)
  })
  it("lets header-less requests through (low-risk actions only)", () => {
    expect(isSameOriginRequest(h({}))).toBe(true)
  })
})
