import { describe, expect, it } from "vitest"
import { buildCheckoutCsp } from "./checkout-csp"
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
    expect(directive(csp, "connect-src")).toEqual([
      "'self'",
      "https://api.example.test",
      "https://api.stripe.com",
      "https://link.com",
      "https://*.link.com",
    ])
    expect(directive(csp, "img-src")).toEqual([
      "'self'",
      "data:",
      "blob:",
      "https://media.example.test",
      "https://*.stripe.com",
      "https://*.link.com",
    ])
    expect(directive(csp, "script-src")).toContain("https://js.stripe.com")
    expect(csp).not.toContain("http://")
  })

  it("copes with no backend URL, image host or Sentry DSN", () => {
    const bare = buildReportOnlyCsp({})
    expect(directive(bare, "connect-src")).toEqual(["'self'", "https://api.stripe.com", "https://link.com", "https://*.link.com"])
    expect(directive(bare, "img-src")).toEqual(["'self'", "data:", "blob:", "https://*.stripe.com", "https://*.link.com"])
  })

  it("allows the Turnstile check on the forms that use it (script and frame)", () => {
    expect(directive(csp, "script-src")).toContain("https://challenges.cloudflare.com")
    expect(directive(csp, "frame-src")).toContain("https://challenges.cloudflare.com")
  })

  it("lets browser error reports reach the Sentry ingest host from the DSN, without the key", () => {
    const withSentry = buildReportOnlyCsp({ sentryDsn: "https://abc123@o42.ingest.de.sentry.io/4507" })
    expect(directive(withSentry, "connect-src")).toContain("https://o42.ingest.de.sentry.io")
    expect(withSentry).not.toContain("abc123")
    // a DSN that is not https (or not a URL) adds nothing
    for (const bad of ["http://abc@o1.ingest.sentry.io/1", "not a url", ""]) {
      expect(buildReportOnlyCsp({ sentryDsn: bad })).toBe(buildReportOnlyCsp({}))
    }
  })

  it("reads the browser Sentry DSN for the site-wide header", () => {
    const path = require.resolve("../../security-headers.js")
    const before = process.env.NEXT_PUBLIC_SENTRY_DSN
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://k@o7.ingest.sentry.io/1"
    try {
      delete require.cache[path]
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require(path).securityHeaders.find((h: { key: string }) => h.key === "Content-Security-Policy-Report-Only")
      expect(directive(fresh.value, "connect-src")).toContain("https://o7.ingest.sentry.io")
    } finally {
      if (before === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN
      else process.env.NEXT_PUBLIC_SENTRY_DSN = before
      delete require.cache[path]
    }
  })
})

// The checkout policy is enforced, the site-wide one only reports. Every
// third-party host checkout allows must be allowed site-wide as well, or the
// report-only policy would flag Stripe and Link on the way into checkout.
describe("site-wide and checkout policies share one host list", () => {
  const opts = { backendUrl: "https://api.example.test", imageHost: "media.example.test" }
  const site = buildReportOnlyCsp(opts)
  const checkout = buildCheckoutCsp({ ...opts, isDev: false, nonce: "n" })

  for (const name of ["script-src", "img-src", "connect-src", "frame-src"]) {
    it(`${name}: every off-site host checkout allows is allowed site-wide`, () => {
      const offsite = directive(checkout, name).filter((v: string) => v.startsWith("https://"))
      expect(offsite.length).toBeGreaterThan(0)
      expect(directive(site, name)).toEqual(expect.arrayContaining(offsite))
    })
  }
})
