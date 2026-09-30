import {
  defaultLowStockThreshold,
  isLowStockHour,
  LowStockVariantRow,
  selectLowStock,
} from "../low-stock"

const LOC = "sloc_shop"

function row(
  id: string,
  stocked: number,
  opts: {
    reserved?: number
    reorder?: number | null
    location?: string
    status?: string
    manage?: boolean
    title?: string
  } = {}
): LowStockVariantRow {
  return {
    id,
    sku: id.toUpperCase(),
    title: opts.title ?? "Black",
    manage_inventory: opts.manage ?? true,
    product: {
      title: "USB-C cable",
      status: opts.status ?? "published",
      product_attributes: opts.reorder === null ? null : { reorder_level: opts.reorder ?? 3 },
    },
    inventory_items: [
      {
        required_quantity: 1,
        inventory: {
          location_levels: [
            {
              location_id: opts.location ?? LOC,
              stocked_quantity: stocked,
              reserved_quantity: opts.reserved ?? 0,
            },
          ],
        },
      },
    ],
  }
}

describe("selectLowStock", () => {
  it("lists variants at or below their reorder level, emptiest first, in the contract shape", () => {
    const items = selectLowStock(
      [row("v_a", 3), row("v_b", 4), row("v_c", 0), row("v_d", 10, { reorder: 12 })],
      LOC,
      3
    )
    expect(items).toEqual([
      { variant_id: "v_c", sku: "V_C", title: "USB-C cable (Black)", stocked_quantity: 0, threshold: 3 },
      { variant_id: "v_a", sku: "V_A", title: "USB-C cable (Black)", stocked_quantity: 3, threshold: 3 },
      { variant_id: "v_d", sku: "V_D", title: "USB-C cable (Black)", stocked_quantity: 10, threshold: 12 },
    ])
  })

  it("compares stocked minus reserved", () => {
    const [item] = selectLowStock([row("v_r", 5, { reserved: 2 })], LOC, 3)
    expect(item).toMatchObject({ variant_id: "v_r", stocked_quantity: 5, threshold: 3 })
  })

  it("uses the fallback threshold without an attributes row", () => {
    expect(selectLowStock([row("v_x", 5, { reorder: null })], LOC, 5)).toHaveLength(1)
    expect(selectLowStock([row("v_x", 5, { reorder: null })], LOC, 4)).toHaveLength(0)
  })

  it("skips other locations, unmanaged variants and unpublished products", () => {
    expect(
      selectLowStock(
        [
          row("v_1", 0, { location: "sloc_other" }),
          row("v_2", 0, { manage: false }),
          row("v_3", 0, { status: "draft" }),
        ],
        LOC,
        3
      )
    ).toEqual([])
  })

  it("uses the product title alone for a default variant", () => {
    const [item] = selectLowStock([row("v_d", 0, { title: "Default" })], LOC, 3)
    expect(item.title).toBe("USB-C cable")
  })
})

describe("defaultLowStockThreshold", () => {
  it("reads LOW_STOCK_THRESHOLD, else 3", () => {
    expect(defaultLowStockThreshold({})).toBe(3)
    expect(defaultLowStockThreshold({ LOW_STOCK_THRESHOLD: "5" })).toBe(5)
    expect(defaultLowStockThreshold({ LOW_STOCK_THRESHOLD: "0" })).toBe(0)
    expect(defaultLowStockThreshold({ LOW_STOCK_THRESHOLD: "-1" })).toBe(3)
    expect(defaultLowStockThreshold({ LOW_STOCK_THRESHOLD: "abc" })).toBe(3)
  })
})

describe("isLowStockHour", () => {
  it("is 08:00 London time in winter (GMT) and summer (BST)", () => {
    expect(isLowStockHour(new Date("2026-01-15T08:00:00Z"))).toBe(true)
    expect(isLowStockHour(new Date("2026-01-15T07:00:00Z"))).toBe(false)
    expect(isLowStockHour(new Date("2026-07-15T07:00:00Z"))).toBe(true)
    expect(isLowStockHour(new Date("2026-07-15T08:00:00Z"))).toBe(false)
  })
})
