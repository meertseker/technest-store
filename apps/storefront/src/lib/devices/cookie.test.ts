import { describe, expect, it } from "vitest"
import { isDeviceSlug, safeReturnPath } from "./cookie"

describe("safeReturnPath", () => {
  it("keeps same-site relative paths with their query", () => {
    expect(safeReturnPath("/c/cases?sort=price")).toBe("/c/cases?sort=price")
    expect(safeReturnPath("/")).toBe("/")
  })
  it("rejects anything that could leave the site", () => {
    for (const bad of ["//evil.com", "/" + String.fromCharCode(92) + "evil.com", "https://evil.com", "javascript:alert(1)", "", null, undefined, "devices"]) {
      expect(safeReturnPath(bad as string)).toBeNull()
    }
  })
  it("never returns to the picker itself", () => {
    expect(safeReturnPath("/devices?q=15")).toBeNull()
    expect(safeReturnPath("/devices/help")).toBe("/devices/help")
  })
})

describe("isDeviceSlug", () => {
  it("accepts kebab-case slugs only", () => {
    expect(isDeviceSlug("iphone-15-pro")).toBe(true)
    expect(isDeviceSlug("iPhone 15")).toBe(false)
    expect(isDeviceSlug("a".repeat(81))).toBe(false)
    expect(isDeviceSlug(undefined)).toBe(false)
  })
})
