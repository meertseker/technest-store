// Lives outside src/search: Medusa imports files under src/search as index definitions.
import { DEVICE_EVENTS } from "../../modules/device/constants"
import { toDeviceTerms } from "../../search/helpers/devices"
import { toOptionValues } from "../../search/helpers/option-values"
import { resolveProductIds } from "../../search/helpers/resolve-product-ids"

const variant = (values: Record<string, string>, deleted_at: string | null = null) => ({
  deleted_at,
  options: Object.entries(values).map(([title, value]) => ({ value, option: { title } })),
})

describe("toOptionValues", () => {
  it("uses only the values the product's own variants have", () => {
    expect(
      toOptionValues([
        variant({ Colour: "Clear", Model: "iPhone 15" }),
        variant({ Colour: "Clear", Model: "iPhone 16" }),
      ])
    ).toEqual(["Colour:Clear", "Model:iPhone 15", "Model:iPhone 16"])
  })

  it("skips soft-deleted variants, empty values and missing option titles", () => {
    expect(
      toOptionValues([
        variant({ Model: "Galaxy S24" }, "2026-09-30T00:00:00Z"),
        { options: [{ value: " ", option: { title: "Model" } }, { value: "x", option: null }] },
        null,
        variant({ Model: " iPhone 15 " }),
      ])
    ).toEqual(["Model:iPhone 15"])
    expect(toOptionValues(undefined)).toEqual([])
  })
})

describe("toDeviceTerms", () => {
  it("lists brand, series, model and aliases once each, skipping deleted devices", () => {
    expect(
      toDeviceTerms([
        { brand: "Apple", series: "iPhone 15", model: "iPhone 15", aliases: ["15", "a3090"] },
        { brand: "Apple", series: "iPhone 15", model: "iPhone 15 Pro", aliases: [] },
        { brand: "Samsung", model: "Galaxy S24", deleted_at: "2026-09-30T00:00:00Z" },
        null,
      ])
    ).toEqual(["Apple", "iPhone 15", "15", "a3090", "iPhone 15 Pro"])
    expect(toDeviceTerms(null)).toEqual([])
  })
})

describe("resolveProductIds for device link changes", () => {
  it("returns the product ids the event carries, without a query", async () => {
    const graph = jest.fn()
    const ids = await resolveProductIds(
      { name: DEVICE_EVENTS.PRODUCT_DEVICES_CHANGED, data: [{ id: "prod_a" }, { id: "prod_b" }] },
      { container: { query: { graph } } } as any
    )
    expect(ids).toEqual(["prod_a", "prod_b"])
    expect(graph).not.toHaveBeenCalled()
  })
})
