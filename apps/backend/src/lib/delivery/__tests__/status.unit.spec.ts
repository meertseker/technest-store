import {
  deliveryStatusOf,
  hasDeliveryMethod,
  paymentStatusOf,
  toDeliveryOrder,
  unshippedFulfillments,
} from ".."

const item = (id: string, quantity: number, fulfilled: number) => ({
  id,
  title: id,
  quantity,
  detail: { fulfilled_quantity: fulfilled },
})
const fulfilment = (
  id: string,
  state: "packed" | "shipped" | "cancelled",
  items: [string, number][] = [["a", 1]]
) => ({
  id,
  shipped_at: state === "shipped" ? "2026-10-05T10:00:00Z" : null,
  canceled_at: state === "cancelled" ? "2026-10-05T09:00:00Z" : null,
  items: items.map(([line_item_id, quantity]) => ({ line_item_id, quantity })),
})

describe("deliveryStatusOf", () => {
  it("is to pack while nothing has been fulfilled", () => {
    expect(deliveryStatusOf({ items: [item("a", 2, 0)], fulfillments: [] })).toBe("to_pack")
  })

  it("is shipped when every item is fulfilled and every live fulfilment has shipped", () => {
    expect(
      deliveryStatusOf({ items: [item("a", 2, 2)], fulfillments: [fulfilment("f1", "shipped")] })
    ).toBe("shipped")
  })

  it("stays to pack when only part of the order has shipped", () => {
    expect(
      deliveryStatusOf({
        items: [item("a", 1, 1), item("b", 1, 0)],
        fulfillments: [fulfilment("f1", "shipped")],
      })
    ).toBe("to_pack")
  })

  it("stays to pack when half an item's quantity has shipped and the row carries the quantity on its detail only", () => {
    // what the order query returns: no `items.quantity` next to `items.detail`
    expect(
      deliveryStatusOf({
        items: [{ id: "a", title: "a", quantity: undefined, detail: { quantity: 2, fulfilled_quantity: 1 } }],
        fulfillments: [fulfilment("f1", "shipped")],
      })
    ).toBe("to_pack")
  })

  it("stays to pack when items were fulfilled but the parcel was never marked shipped", () => {
    expect(
      deliveryStatusOf({ items: [item("a", 2, 2)], fulfillments: [fulfilment("f1", "packed")] })
    ).toBe("to_pack")
    // one parcel gone, the other still on the counter
    expect(
      deliveryStatusOf({
        items: [item("a", 1, 1), item("b", 1, 1)],
        fulfillments: [fulfilment("f1", "shipped"), fulfilment("f2", "packed", [["b", 1]])],
      })
    ).toBe("to_pack")
  })

  it("ignores cancelled fulfilments", () => {
    expect(
      deliveryStatusOf({
        items: [item("a", 1, 1)],
        fulfillments: [fulfilment("f0", "cancelled"), fulfilment("f1", "shipped")],
      })
    ).toBe("shipped")
    expect(
      deliveryStatusOf({ items: [item("a", 1, 0)], fulfillments: [fulfilment("f0", "cancelled")] })
    ).toBe("to_pack")
  })
})

describe("unshippedFulfillments", () => {
  it("returns live fulfilments without a shipment, with the order items they hold", () => {
    expect(
      unshippedFulfillments({
        fulfillments: [
          fulfilment("f0", "cancelled"),
          fulfilment("f1", "shipped"),
          fulfilment("f2", "packed", [["b", 2], ["c", 1]]),
        ],
      })
    ).toEqual([{ id: "f2", items: [{ id: "b", quantity: 2 }, { id: "c", quantity: 1 }] }])
    expect(unshippedFulfillments({ fulfillments: null })).toEqual([])
  })
})

describe("hasDeliveryMethod", () => {
  const pickup = new Set(["so_pickup"])

  it("is true for an order sent by a carrier", () => {
    expect(hasDeliveryMethod({ shipping_methods: [{ shipping_option_id: "so_standard" }] }, pickup)).toBe(true)
  })

  it("is false for Click & Collect", () => {
    expect(hasDeliveryMethod({ shipping_methods: [{ shipping_option_id: "so_pickup" }] }, pickup)).toBe(false)
  })

  it("is false for an order with no shipping method at all", () => {
    expect(hasDeliveryMethod({ shipping_methods: [] }, pickup)).toBe(false)
    expect(hasDeliveryMethod({ shipping_methods: null }, pickup)).toBe(false)
  })
})

describe("paymentStatusOf and the list row", () => {
  const captured = { captured_at: "2026-10-04T10:00:00Z", canceled_at: null, captures: [{ amount: 10 }], refunds: [] }
  const base = { id: "order_1", status: "pending", created_at: "2026-10-04T09:00:00Z", total: 10 }

  it("tells paid, not taken and refunded apart", () => {
    expect(paymentStatusOf({ ...base, payment_collections: [{ payments: [captured] }] })).toBe("paid")
    expect(
      paymentStatusOf({ ...base, payment_collections: [{ payments: [{ captured_at: null, canceled_at: null }] }] })
    ).toBe("not_taken")
    expect(paymentStatusOf({ ...base, payment_collections: [] })).toBe("not_taken")
    expect(
      paymentStatusOf({
        ...base,
        payment_collections: [{ payments: [{ ...captured, refunds: [{ amount: 10 }] }] }],
      })
    ).toBe("refunded")
    expect(paymentStatusOf({ ...base, total: 0, payment_collections: [] })).toBe("paid")
  })

  it("puts the payment state and a part-shipped flag on the row", () => {
    const row = toDeliveryOrder({
      ...base,
      items: [item("a", 1, 1), item("b", 1, 0)],
      fulfillments: [fulfilment("f1", "shipped")],
      payment_collections: [{ payments: [{ captured_at: null, canceled_at: null }] }],
    })
    expect(row).toMatchObject({
      status: "to_pack",
      payment_status: "not_taken",
      partly_shipped: true,
      shipped_at: null,
    })
  })
})
