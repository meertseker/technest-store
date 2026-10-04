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

  // The category is staff's filing choice; the product is a charger wherever it is filed.
  it.each([
    ["no category, charger in the title", { title: "20W USB-C Charger" }],
    ["filed under another category", { title: "35W Dual USB-C Wall Charger", categories: [{ handle: "cases" }] }],
    ["a power bank by its title", { title: "10000mAh Power Bank" }],
    ["one word: Powerbank", { title: "Slim Powerbank 5000" }],
    ["the handle says charger", { title: "GaN 65", handle: "gan-65-laptop-charger" }],
    ["a tag says power bank", { title: "Slim 5000", tags: [{ value: "power bank" }] }],
    ["a charging pad", { title: "Wireless Charging Pad" }],
    ["a charging dock", { title: "3-in-1 Charging Dock" }],
    ["a wall plug", { title: "USB-C Wall Plug" }],
    ["a mains adaptor", { title: "UK Mains Adaptor" }],
    ["watts in the title", { title: "GaN 65W Dual Port" }],
    ["a wattage is set", { title: "Travel Plug", product_attributes: { safety_marking: "none", wattage: 20 } }],
  ])("blocks an unmarked power product outside the charger categories: %s", (_label, product) => {
    expect(publishBlocker({ id: "p", status: "published", ...product })).toContain(
      "safety marking (UKCA or CE)"
    )
  })

  it("lets a marked power product outside the charger categories through", () => {
    expect(
      publishBlocker({
        id: "p",
        title: "20W USB-C Charger",
        status: "published",
        product_attributes: { safety_marking: "UKCA", wattage: 20 },
      })
    ).toBeNull()
  })

  it.each([["Clear Case with Wireless Charging Support"], ["USB-C to 3.5mm Audio Adapter"], ["Screen Protector 2 Pack W/ Frame"]])(
    "doesn't read a power product into %j",
    (title) => {
      expect(publishBlocker({ id: "p", title, status: "published" })).toBeNull()
    }
  )

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

  it("reads vape words from handles (hyphens as spaces) and categories", () => {
    expect(
      publishBlocker({ id: "p", title: "Mint 10ml", handle: "e-liquid-mint-10ml", status: "published" })
    ).toContain("vape")
    expect(
      publishBlocker({ id: "p", title: "Starter kit", handle: "ecig-starter", status: "published" })
    ).toContain("vape")
    expect(
      publishBlocker({
        id: "p",
        title: "Pod kit",
        status: "published",
        categories: [{ handle: "pods", name: "Pods", parent_category: { handle: "vapes", name: "Vapes" } }],
      })
    ).toContain("vape")
    expect(
      publishBlocker({ id: "p", title: "Vape 600", status: "draft" })
    ).toBeNull()
  })

  it("puts the vape refusal first, even for a marked charger", () => {
    expect(
      publishBlocker({
        id: "p",
        title: "Vape charger",
        status: "published",
        categories: [chargers],
        product_attributes: { safety_marking: "UKCA" },
      })
    ).toContain("Vapes are never sold online")
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
