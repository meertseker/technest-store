import { attributesFromMetadata } from "../backfill-attributes"

describe("attributesFromMetadata", () => {
  it("reads the pre-ADR metadata keys into typed values", () => {
    expect(
      attributesFromMetadata(
        {
          safety_marking: "UKCA",
          connector_a: "USB-C",
          wattage: "20",
          is_addon_item: "true",
          platform: ["ps5", "bogus"],
          warranty_months: 12,
        },
        [{ reorder_level: 8 }, { reorder_level: 8 }]
      )
    ).toEqual({
      safety_marking: "UKCA",
      connector_a: "USB-C",
      wattage: 20,
      is_addon_item: true,
      platform: ["ps5"],
      warranty_months: 12,
      reorder_level: 8,
    })
  })

  it("ignores junk and empty metadata", () => {
    expect(
      attributesFromMetadata({ safety_marking: "ukca ", is_addon_item: "false", wattage: -1 }, [])
    ).toEqual({})
    expect(attributesFromMetadata(null, [null])).toEqual({})
  })
})
