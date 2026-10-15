import { AdminCreateDevice, AdminUpdateDevice } from "../admin/devices/middlewares"
import {
  scrubPrivateAttributes,
  STORE_PRODUCT_ATTRIBUTE_FIELDS,
} from "../store/products/middlewares"

describe("store product attribute fields", () => {
  it("never lets the public read reorder_level (the shop's restock threshold)", () => {
    expect(STORE_PRODUCT_ATTRIBUTE_FIELDS).not.toContain("product_attributes.reorder_level")
    expect(STORE_PRODUCT_ATTRIBUTE_FIELDS).toEqual(
      expect.arrayContaining(["product_attributes", "product_attributes.safety_marking", "product_attributes.is_addon_item"])
    )
  })

  it("strips reorder_level from product responses, whatever the wildcard expanded to", () => {
    const attrs = { safety_marking: "UKCA", reorder_level: 3, wattage: 20 }
    expect(scrubPrivateAttributes({ product: { id: "p1", product_attributes: { ...attrs } } })).toEqual({
      product: { id: "p1", product_attributes: { safety_marking: "UKCA", wattage: 20 } },
    })
    expect(
      scrubPrivateAttributes({
        products: [
          { id: "p1", product_attributes: { ...attrs } },
          { id: "p2", product_attributes: null },
          { id: "p3" },
        ],
        count: 3,
      })
    ).toEqual({
      products: [
        { id: "p1", product_attributes: { safety_marking: "UKCA", wattage: 20 } },
        { id: "p2", product_attributes: null },
        { id: "p3" },
      ],
      count: 3,
    })
    // Other bodies pass through untouched.
    expect(scrubPrivateAttributes({ message: "no" })).toEqual({ message: "no" })
    expect(scrubPrivateAttributes(undefined)).toBeUndefined()
  })
})

describe("admin device input bounds", () => {
  const device = (over: Record<string, unknown> = {}) => ({
    brand: "Apple",
    series: "iPhone 16",
    model: "iPhone 16 Pro",
    type: "phone",
    ...over,
  })

  it("accepts a normal device with an https image", () => {
    const parsed = AdminCreateDevice.safeParse(
      device({ aliases: ["16 pro"], image_url: "https://cdn.example/iphone.png", release_year: 2024 })
    )
    expect(parsed.success).toBe(true)
  })

  it.each([
    ["javascript: image url", device({ image_url: "javascript:alert(1)" })],
    ["http image url", device({ image_url: "http://cdn.example/iphone.png" })],
    ["data image url", device({ image_url: "data:text/html,hi" })],
    ["brand over 100 chars", device({ brand: "a".repeat(101) })],
    ["series over 100 chars", device({ series: "a".repeat(101) })],
    ["model over 100 chars", device({ model: "a".repeat(101) })],
    ["more than 20 aliases", device({ aliases: Array.from({ length: 21 }, (_, i) => `alias ${i}`) })],
    ["an alias over 100 chars", device({ aliases: ["a".repeat(101)] })],
  ])("rejects %s on create and update", (_name, body) => {
    expect(AdminCreateDevice.safeParse(body).success).toBe(false)
    const { type: _type, ...update } = body as Record<string, unknown>
    expect(AdminUpdateDevice.safeParse(update).success).toBe(false)
  })

  it("still allows a null image and the limits themselves", () => {
    expect(AdminCreateDevice.safeParse(device({ image_url: null })).success).toBe(true)
    expect(
      AdminCreateDevice.safeParse(
        device({ brand: "b".repeat(100), aliases: Array.from({ length: 20 }, (_, i) => "x".repeat(100 - (i % 3))) })
      ).success
    ).toBe(true)
  })
})
