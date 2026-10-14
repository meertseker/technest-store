import { shortSharedInventory, type SharedStockLine } from "../shared-stock"

const line = (over: Partial<SharedStockLine> = {}): SharedStockLine => ({
  variant_id: "variant_a",
  quantity: 1,
  manage_inventory: true,
  allow_backorder: false,
  inventory_items: [{ inventory_item_id: "iitem_a", required_quantity: 1 }],
  ...over,
})

describe("shortSharedInventory", () => {
  const stock = (available: number, location = "sloc_1") => new Map([[location, new Map([["iitem_a", available]])]])

  it("flags two lines of the same item that together need more than is available", () => {
    expect(shortSharedInventory([line({ quantity: 3 }), line({ quantity: 3 })], stock(5))).toEqual(["iitem_a"])
  })

  it("passes when the lines together fit", () => {
    expect(shortSharedInventory([line({ quantity: 2 }), line({ quantity: 3 })], stock(5))).toEqual([])
  })

  it("leaves a single line to Medusa's own check", () => {
    expect(shortSharedInventory([line({ quantity: 9 })], stock(5))).toEqual([])
  })

  it("counts the inventory item's required quantity per unit (bundles)", () => {
    const bundle = line({ variant_id: "variant_b", inventory_items: [{ inventory_item_id: "iitem_a", required_quantity: 2 }] })
    expect(shortSharedInventory([line({ quantity: 1 }), { ...bundle, quantity: 2 }], stock(4))).toEqual(["iitem_a"])
    expect(shortSharedInventory([line({ quantity: 1 }), { ...bundle, quantity: 2 }], stock(5))).toEqual([])
  })

  it("ignores lines that may be backordered or whose stock isn't managed", () => {
    expect(
      shortSharedInventory([line({ quantity: 3 }), line({ quantity: 3, allow_backorder: true })], stock(5))
    ).toEqual([])
    expect(
      shortSharedInventory([line({ quantity: 3 }), line({ quantity: 3, manage_inventory: false })], stock(5))
    ).toEqual([])
  })

  it("needs one location that can cover the lines together (each reservation takes one location)", () => {
    const split = new Map([
      ["sloc_1", new Map([["iitem_a", 3]])],
      ["sloc_2", new Map([["iitem_a", 3]])],
    ])
    expect(shortSharedInventory([line({ quantity: 3 }), line({ quantity: 3 })], split)).toEqual(["iitem_a"])
    expect(shortSharedInventory([line({ quantity: 3 }), line({ quantity: 3 })], stock(6, "sloc_2"))).toEqual([])
  })

  it("flags an item with no stock level at all", () => {
    expect(shortSharedInventory([line(), line()], new Map())).toEqual(["iitem_a"])
  })
})
