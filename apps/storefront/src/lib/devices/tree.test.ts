import { describe, expect, it } from "vitest"
import { MOCK_DEVICE_TREE } from "./mock"
import {
  brandSlug,
  deviceHref,
  findBrand,
  findDevice,
  flattenDevices,
  searchDevices,
} from "./tree"

describe("device tree helpers", () => {
  it("flattens brand -> series -> device in order", () => {
    const all = flattenDevices(MOCK_DEVICE_TREE)
    expect(all.length).toBe(MOCK_DEVICE_TREE.count)
    expect(all[0].brand).toBe("Apple")
  })

  it("finds a device by slug and a brand by its URL slug", () => {
    expect(findDevice(MOCK_DEVICE_TREE, "iphone-15-pro")?.model).toBe("iPhone 15 Pro")
    expect(findDevice(MOCK_DEVICE_TREE, "nope")).toBeUndefined()
    expect(findBrand(MOCK_DEVICE_TREE, "apple")?.brand).toBe("Apple")
  })

  it("builds landing URLs /devices/[brand]/[model]", () => {
    expect(brandSlug("Google Pixel")).toBe("google-pixel")
    const d = findDevice(MOCK_DEVICE_TREE, "galaxy-s24-ultra")!
    expect(deviceHref(d)).toBe("/devices/samsung/galaxy-s24-ultra")
  })

  describe("searchDevices", () => {
    const models = (q: string) => searchDevices(MOCK_DEVICE_TREE, q).map((d) => d.model)

    it("matches model text ignoring case, spaces and punctuation", () => {
      expect(models("iphone15pro")).toContain("iPhone 15 Pro")
      expect(models("IPHONE 15 PRO")).toContain("iPhone 15 Pro Max")
    })
    it("matches aliases such as model numbers", () => {
      expect(models("a2848")).toEqual(["iPhone 15 Pro"])
    })
    it("matches every word across brand and model", () => {
      expect(models("samsung s24 ultra")).toEqual(["Galaxy S24 Ultra"])
      expect(models("apple 15 pro")).toEqual(["iPhone 15 Pro", "iPhone 15 Pro Max"])
    })
    it("ranks exact and prefix matches first", () => {
      expect(models("ps5")[0]).toBe("PlayStation 5")
      expect(models("iphone 15")[0]).toBe("iPhone 15")
    })
    it("returns nothing for a blank query", () => {
      expect(models("  ")).toEqual([])
    })
  })
})
