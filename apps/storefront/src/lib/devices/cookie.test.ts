import { describe, expect, it } from "vitest"
import { isDeviceSlug, isPickerPath, pickerHref, safeReturnPath } from "./cookie"

const BS = String.fromCharCode(92)

describe("safeReturnPath", () => {
  it("keeps same-site relative paths exactly, query and hash included", () => {
    expect(safeReturnPath("/c/cases?sort=price")).toBe("/c/cases?sort=price")
    expect(safeReturnPath("/")).toBe("/")
    expect(safeReturnPath("/c/cases/?page=2#grid")).toBe("/c/cases/?page=2#grid")
    expect(safeReturnPath("/p/usb-c-cable")).toBe("/p/usb-c-cable")
  })
  it("never adds a trailing slash", () => {
    expect(safeReturnPath("/cart")).toBe("/cart")
    expect(safeReturnPath("/devices/help")).toBe("/devices/help")
    expect(safeReturnPath("/devices/apple/iphone-15-pro")).toBe("/devices/apple/iphone-15-pro")
  })
  it("rejects anything that could leave the site", () => {
    for (const bad of [
      "//evil.com",
      "///evil.com",
      "/" + BS + "evil.com",
      "/" + BS + BS + "evil.com",
      "/x" + BS + "y",
      "/\t/evil.com",
      "/\n/evil.com",
      "https://evil.com",
      "http:/evil.com",
      "javascript:alert(1)",
      "",
      null,
      undefined,
      "devices",
      "/" + "a".repeat(2048),
    ]) {
      expect(safeReturnPath(bad as string), String(bad)).toBeNull()
    }
  })
  it("never returns to the picker itself, with or without a trailing slash", () => {
    expect(safeReturnPath("/devices")).toBeNull()
    expect(safeReturnPath("/devices/")).toBeNull()
    expect(safeReturnPath("/devices//")).toBeNull()
    expect(safeReturnPath("/Devices?q=15")).toBeNull()
    expect(safeReturnPath("/devices?q=15")).toBeNull()
    expect(safeReturnPath("/devices/?returnTo=/cart")).toBeNull()
  })
})

describe("isPickerPath", () => {
  it("matches only the picker", () => {
    expect(isPickerPath("/devices")).toBe(true)
    expect(isPickerPath("/devices/")).toBe(true)
    expect(isPickerPath("/devices/help")).toBe(false)
    expect(isPickerPath("/devicesx")).toBe(false)
  })
})

describe("pickerHref", () => {
  const returnToOf = (href: string) => new URL(href, "http://x").searchParams.get("returnTo")

  it("keeps the current query string", () => {
    const href = pickerHref("/c/cases", "?sort=price&page=2")
    expect(href.startsWith("/devices?returnTo=")).toBe(true)
    expect(returnToOf(href)).toBe("/c/cases?sort=price&page=2")
    expect(pickerHref("/c/cases", "sort=price")).toBe(pickerHref("/c/cases", "?sort=price"))
  })
  it("returns to the exact page, with no trailing slash", () => {
    expect(returnToOf(pickerHref("/cart"))).toBe("/cart")
    expect(returnToOf(pickerHref("/devices/help"))).toBe("/devices/help")
    expect(pickerHref("/cart")).toBe("/devices?returnTo=%2Fcart")
  })
  it("uses the bare picker from home and for unsafe paths", () => {
    expect(pickerHref("/")).toBe("/devices")
    expect(pickerHref("/", "")).toBe("/devices")
    expect(pickerHref(null)).toBe("/devices")
    expect(pickerHref("//evil.com")).toBe("/devices")
  })
  it("keeps the home query string (home is only bare without one)", () => {
    expect(returnToOf(pickerHref("/", "?utm=x"))).toBe("/?utm=x")
  })
  it("on the picker keeps its own valid returnTo and never nests the picker", () => {
    expect(pickerHref("/devices", "?q=15&returnTo=%2Fcart")).toBe("/devices?returnTo=%2Fcart")
    expect(pickerHref("/devices/", "?returnTo=%2Fcart")).toBe("/devices?returnTo=%2Fcart")
    expect(pickerHref("/devices", "?q=15")).toBe("/devices")
    expect(pickerHref("/devices", "?returnTo=%2F%2Fevil.com")).toBe("/devices")
    expect(pickerHref("/devices", "?returnTo=%2Fdevices%2F")).toBe("/devices")
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
