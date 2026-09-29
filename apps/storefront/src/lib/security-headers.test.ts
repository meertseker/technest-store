import { describe, expect, it } from "vitest"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { securityHeaders, loadCheckoutCsp } = require("../../security-headers.js")

const get = (k: string) =>
  securityHeaders.find((h: { key: string }) => h.key === k)?.value

describe("securityHeaders", () => {
  it("sets the baseline headers", () => {
    expect(get("X-Content-Type-Options")).toBe("nosniff")
    expect(get("Referrer-Policy")).toBe("strict-origin-when-cross-origin")
    expect(get("X-Frame-Options")).toBe("DENY")
    expect(get("Permissions-Policy")).toContain("camera=()")
    expect(get("Strict-Transport-Security")).toContain("max-age=63072000")
  })
})

describe("loadCheckoutCsp", () => {
  const notFound = () => {
    throw Object.assign(new Error("Cannot find module './checkout-csp'"), {
      code: "MODULE_NOT_FOUND",
    })
  }

  it("returns null while E2's file does not exist", () => {
    expect(loadCheckoutCsp(notFound)).toBeNull()
  })

  it("returns the policy string when the file exports one", () => {
    expect(loadCheckoutCsp(() => ({ checkoutCsp: "default-src 'self'" }))).toBe(
      "default-src 'self'"
    )
  })

  it("fails the build if the file is broken instead of dropping the CSP", () => {
    expect(() =>
      loadCheckoutCsp(() => {
        throw new SyntaxError("Unexpected token")
      })
    ).toThrow(SyntaxError)
  })

  it("fails the build if the file exports no checkoutCsp string", () => {
    expect(() => loadCheckoutCsp(() => ({ csp: "x" }))).toThrow(/checkoutCsp/)
  })
})
