import { ProductAttributes, toForm, toPayload, withUnit } from "../product-attributes"

const defaults: ProductAttributes = {
  connector_a: null,
  connector_b: null,
  wattage: null,
  cable_length_m: null,
  platform: [],
  is_addon_item: false,
  safety_marking: "none",
  warranty_months: null,
  reorder_level: 3,
}

describe("product attributes form", () => {
  it("round-trips without changes", () => {
    const current: ProductAttributes = {
      ...defaults,
      connector_a: "USB-C",
      wattage: 20,
      cable_length_m: 1.5,
      platform: ["ps5", "pc"],
      safety_marking: "UKCA",
    }
    expect(toPayload(toForm(current), current)).toEqual({
      payload: {},
      errors: {},
    })
  })

  it("sends only changed fields, with numbers parsed and empties cleared", () => {
    const current: ProductAttributes = {
      ...defaults,
      connector_b: "Lightning",
      wattage: 18,
    }
    const form = {
      ...toForm(current),
      connector_a: "  USB-C ",
      connector_b: "",
      wattage: "65",
      cable_length_m: "1,5",
      platform: ["pc", "ps5"] as ProductAttributes["platform"],
      is_addon_item: true,
      safety_marking: "CE" as const,
      warranty_months: "12",
      reorder_level: "0",
    }
    expect(toPayload(form, current)).toEqual({
      errors: {},
      payload: {
        connector_a: "USB-C",
        connector_b: null,
        wattage: 65,
        cable_length_m: 1.5,
        platform: ["ps5", "pc"],
        is_addon_item: true,
        safety_marking: "CE",
        warranty_months: 12,
        reorder_level: 0,
      },
    })
  })

  it("rejects values the server would refuse", () => {
    const form = {
      ...toForm(defaults),
      wattage: "-5",
      cable_length_m: "abc",
      warranty_months: "1.5",
      reorder_level: "",
      connector_a: "x".repeat(61),
    }
    const { errors } = toPayload(form, defaults)
    expect(errors).toEqual({
      wattage: "Wattage can't be negative.",
      cable_length_m: "Cable length must be a number.",
      warranty_months: "Warranty must be a whole number.",
      reorder_level: "Enter a reorder level (0 or more).",
      connector_a: "Use 60 characters or fewer.",
    })
    expect(toPayload({ ...toForm(defaults), warranty_months: "241" }, defaults).errors).toEqual({
      warranty_months: "Warranty can be at most 240.",
    })
  })

  it("formats units", () => {
    expect(withUnit(null, "W")).toBe("-")
    expect(withUnit(1, "month", "months")).toBe("1 month")
    expect(withUnit(12, "month", "months")).toBe("12 months")
  })
})
