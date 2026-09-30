import { publishBlocker, withDefaults } from "../utils"

const chargers = { handle: "chargers-cables", parent_category: { handle: "phone-accessories" } }

describe("publishBlocker", () => {
  it("lets drafts through whatever they are", () => {
    expect(publishBlocker({ id: "p", status: "draft", categories: [chargers] })).toBeNull()
  })

  it("blocks a published charger without UKCA or CE, with a clear message", () => {
    const reason = publishBlocker({
      id: "p",
      title: "20W USB-C Plug",
      status: "published",
      categories: [chargers],
      product_attributes: { safety_marking: "none" },
    })
    expect(reason).toContain("20W USB-C Plug")
    expect(reason).toContain("safety marking (UKCA or CE)")
  })

  it("blocks when the attributes row is missing", () => {
    expect(
      publishBlocker({ id: "p", status: "published", categories: [{ handle: "power-banks" }] })
    ).not.toBeNull()
  })

  it("checks parent categories too (a child of Chargers & Cables)", () => {
    expect(
      publishBlocker({
        id: "p",
        status: "published",
        categories: [{ handle: "usb-c-cables", parent_category: chargers }],
      })
    ).not.toBeNull()
  })

  it("allows a marked charger and unguarded categories", () => {
    for (const marking of ["UKCA", "CE"]) {
      expect(
        publishBlocker({
          id: "p",
          status: "published",
          categories: [chargers],
          product_attributes: { safety_marking: marking },
        })
      ).toBeNull()
    }
    expect(
      publishBlocker({ id: "p", status: "published", categories: [{ handle: "cases" }] })
    ).toBeNull()
  })

  it("never publishes vapes", () => {
    expect(
      publishBlocker({ id: "p", title: "Disposable Vape 600", status: "published" })
    ).toContain("vape")
    expect(
      publishBlocker({ id: "p", title: "Pod", status: "published", tags: [{ value: "e-liquid" }] })
    ).toContain("vape")
    expect(
      publishBlocker({ id: "p", title: "Evaporative cooling pad", status: "published" })
    ).toBeNull()
  })
})

describe("withDefaults", () => {
  it("fills missing and null values with the ADR defaults", () => {
    expect(withDefaults(null)).toEqual({
      connector_a: null,
      connector_b: null,
      wattage: null,
      cable_length_m: null,
      platform: [],
      is_addon_item: false,
      safety_marking: "none",
      warranty_months: null,
      reorder_level: 3,
    })
    expect(withDefaults({ is_addon_item: true, reorder_level: 10 })).toMatchObject({
      is_addon_item: true,
      reorder_level: 10,
    })
  })
})
