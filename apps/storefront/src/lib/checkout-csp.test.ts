import { afterEach, describe, expect, it, vi } from "vitest"
import { buildCheckoutCsp } from "./checkout-csp"

const prod = buildCheckoutCsp({
  isDev: false,
  backendUrl: "https://api.technest.co.uk",
  imageHost: "images.technest.co.uk",
  nonce: "bm9uY2U",
})

function directive(csp: string, name: string): string[] {
  const part = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `))
  return part ? part.split(/\s+/).slice(1) : []
}

describe("checkout CSP", () => {
  it("allows Stripe.js (and only Stripe) as a third-party script", () => {
    const scripts = directive(prod, "script-src")
    expect(scripts).toEqual(
      expect.arrayContaining(["'self'", "https://js.stripe.com", "https://*.js.stripe.com"])
    )
    const thirdParty = scripts.filter((s) => s.startsWith("https://"))
    expect(thirdParty.every((s) => /^https:\/\/(\*\.)?js\.stripe\.com$/.test(s))).toBe(true)
  })

  it("trusts scripts by per-request nonce, not 'unsafe-inline'", () => {
    const scripts = directive(prod, "script-src")
    expect(scripts).toContain("'nonce-bm9uY2U'")
    expect(scripts).toContain("'strict-dynamic'")
    expect(scripts).not.toContain("'unsafe-inline'")
  })

  it("never allows eval in production", () => {
    expect(prod).not.toContain("'unsafe-eval'")
  })

  it("lets Stripe frames load for the Payment Element, 3D Secure, wallets and Link", () => {
    expect(directive(prod, "frame-src")).toEqual(
      expect.arrayContaining([
        "https://js.stripe.com",
        "https://*.js.stripe.com",
        "https://hooks.stripe.com",
        "https://link.com",
        "https://*.link.com",
      ])
    )
  })

  it("lets the browser talk to Stripe's API and our Medusa backend", () => {
    expect(directive(prod, "connect-src")).toEqual(
      expect.arrayContaining(["'self'", "https://api.stripe.com", "https://api.technest.co.uk"])
    )
  })

  it("allows product images from our image host and Stripe's", () => {
    expect(directive(prod, "img-src")).toEqual(
      expect.arrayContaining(["'self'", "https://images.technest.co.uk", "https://*.stripe.com"])
    )
  })

  it("locks down framing, plugins, base and form targets", () => {
    expect(directive(prod, "default-src")).toEqual(["'self'"])
    expect(directive(prod, "frame-ancestors")).toEqual(["'none'"])
    expect(directive(prod, "object-src")).toEqual(["'none'"])
    expect(directive(prod, "base-uri")).toEqual(["'self'"])
    expect(directive(prod, "form-action")).toEqual(["'self'"])
  })

  it("permits eval only in dev (React Refresh) and no insecure upgrade there", () => {
    const dev = buildCheckoutCsp({ isDev: true, backendUrl: "http://localhost:9002", nonce: "n" })
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'")
    expect(dev).not.toContain("upgrade-insecure-requests")
    expect(prod).toContain("upgrade-insecure-requests")
  })

})

describe("next.config.js", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("no longer sets a static /checkout CSP (the middleware owns it)", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY", "pk_test")
    const path = require.resolve("../../next.config.js")
    delete require.cache[path]
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nextConfig = require(path)
    const rules: { source: string; headers: { key: string }[] }[] = await nextConfig.headers()
    const csp = rules.flatMap((r) => r.headers).filter((h) => h.key === "Content-Security-Policy")
    expect(csp).toEqual([])
  })
})
