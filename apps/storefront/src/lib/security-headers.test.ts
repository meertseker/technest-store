import { describe, expect, it } from "vitest"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { securityHeaders } = require("../../security-headers.js")

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
