import { describe, expect, it } from "vitest"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { securityHeaders, buildReportOnlyCsp } = require("../../security-headers.js")

const get = (k: string) =>
  securityHeaders.find((h: { key: string }) => h.key === k)?.value

const directive = (csp: string, name: string) =>
  csp
    .split(";")
    .map((s: string) => s.trim())
    .find((s: string) => s.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(" ") ?? []

describe("securityHeaders", () => {
  it("sets the baseline headers", () => {
    expect(get("X-Content-Type-Options")).toBe("nosniff")
    expect(get("Referrer-Policy")).toBe("strict-origin-when-cross-origin")
    expect(get("X-Frame-Options")).toBe("DENY")
    expect(get("Permissions-Policy")).toContain("camera=()")
  })

  it("leaves HSTS to Caddy, so there is one value for every host", () => {
    // Caddy fronts the storefront, the API and the admin and sets the header
    // itself (Caddyfile); a second, different value from Next only confused matters.
    expect(get("Strict-Transport-Security")).toBeUndefined()
  })

  it("reports CSP violations site-wide without blocking anything outside /checkout", () => {
    expect(get("Content-Security-Policy")).toBeUndefined()
    const csp = get("Content-Security-Policy-Report-Only")
    expect(directive(csp, "default-src")).toEqual(["'self'"])
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"])
    expect(directive(csp, "object-src")).toEqual(["'none'"])
    expect(directive(csp, "form-action")).toEqual(["'self'"])
  })
})

describe("buildReportOnlyCsp", () => {
  const csp = buildReportOnlyCsp({ backendUrl: "https://api.example.test/x", imageHost: "media.example.test" })

  it("allows the backend, the image host and Stripe's hosts, and nothing else off-site", () => {
    expect(directive(csp, "connect-src")).toEqual(["'self'", "https://api.example.test", "https://api.stripe.com"])
    expect(directive(csp, "img-src")).toEqual(["'self'", "data:", "blob:", "https://media.example.test", "https://*.stripe.com"])
    expect(directive(csp, "script-src")).toContain("https://js.stripe.com")
    expect(csp).not.toContain("http://")
  })

  it("copes with no backend URL or image host", () => {
    const bare = buildReportOnlyCsp({})
    expect(directive(bare, "connect-src")).toEqual(["'self'", "https://api.stripe.com"])
    expect(directive(bare, "img-src")).toEqual(["'self'", "data:", "blob:", "https://*.stripe.com"])
  })
})
