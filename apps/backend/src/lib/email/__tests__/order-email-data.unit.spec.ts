import { toOrderEmailData } from "../order-email-data"

const base = {
  id: "order_1",
  display_id: 7,
  email: "sam@example.com",
  shipping_address: { first_name: "Sam", last_name: "Smith", address_1: "1 High St", city: "London", postal_code: "SE16 1AA" },
  shipping_methods: [{ name: "Standard delivery", shipping_option_id: "so_1" }],
  customer: null,
}

// Sum of the lines the customer sees must equal the total.
function linesAddUp(d: ReturnType<typeof toOrderEmailData>) {
  return d.subtotal_pence - d.discount_total_pence + d.shipping_total_pence === d.total_pence
}

describe("toOrderEmailData", () => {
  it("shows items before discount and one discount line, so the lines add up (item promotion)", () => {
    const d = toOrderEmailData(
      {
        ...base,
        original_item_total: 100,
        item_total: 90,
        shipping_total: 3.49,
        tax_total: 15.58,
        total: 93.49,
        items: [{ title: "Case", quantity: 1, unit_price: 100, original_total: 100, total: 90 }],
      },
      false
    )
    expect(d.items[0].total_pence).toBe(10000)
    expect(d.subtotal_pence).toBe(10000)
    expect(d.discount_total_pence).toBe(1000)
    expect(d.shipping_total_pence).toBe(349)
    expect(linesAddUp(d)).toBe(true)
  })

  it("does not count a free-shipping promotion twice", () => {
    const d = toOrderEmailData(
      {
        ...base,
        original_item_total: 20,
        item_total: 20,
        shipping_total: 0,
        discount_total: 3.49,
        tax_total: 3.33,
        total: 20,
        items: [{ title: "Cable", quantity: 2, unit_price: 10, original_total: 20, total: 20 }],
      },
      false
    )
    expect(d.discount_total_pence).toBe(0)
    expect(d.shipping_total_pence).toBe(0)
    expect(linesAddUp(d)).toBe(true)
  })

  it("maps a pickup order to Click & Collect without an address", () => {
    const d = toOrderEmailData(
      { ...base, original_item_total: 5, item_total: 5, shipping_total: 0, tax_total: 0.83, total: 5, items: [] },
      true
    )
    expect(d.fulfilment).toEqual({ type: "collection", method_name: "Click & Collect" })
    expect(d.shipping_address).toBeNull()
  })
})
