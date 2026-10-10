import { deliveryPlace, deliverySummary, paymentBadge, shipBlocker } from "../delivery"

describe("deliverySummary", () => {
  it("lists quantity × title, with the variant in brackets when there is one", () => {
    expect(
      deliverySummary({
        items: [
          { id: "a", title: "USB-C cable", variant_title: "1 m", quantity: 2, thumbnail: null },
          { id: "b", title: "Case", variant_title: null, quantity: 1, thumbnail: null },
        ],
      })
    ).toBe("2 × USB-C cable (1 m), 1 × Case")
  })

  it("is empty for an order without items", () => {
    expect(deliverySummary({ items: [] })).toBe("")
  })
})

describe("deliveryPlace", () => {
  it("joins postcode and city, and copes with either missing", () => {
    expect(deliveryPlace({ postcode: "SE16 1AA", city: "London" })).toBe("SE16 1AA, London")
    expect(deliveryPlace({ postcode: "SE16 1AA", city: null })).toBe("SE16 1AA")
    expect(deliveryPlace({ postcode: null, city: null })).toBeNull()
  })
})

describe("paymentBadge", () => {
  it("warns in words, not colour alone, when the payment was not taken or was refunded", () => {
    expect(paymentBadge({ payment_status: "not_taken" })).toEqual({ label: "Payment not taken", color: "red" })
    expect(paymentBadge({ payment_status: "refunded" })).toEqual({ label: "Refunded", color: "grey" })
  })

  it("shows nothing for a paid order", () => {
    expect(paymentBadge({ payment_status: "paid" })).toBeNull()
  })
})

describe("shipBlocker", () => {
  it("says why Packed & shipped is off before anyone presses it", () => {
    expect(shipBlocker({ payment_status: "not_taken" })).toMatch(/payment hasn't been taken/i)
    expect(shipBlocker({ payment_status: "not_taken" })).toMatch(/open the order/i)
    expect(shipBlocker({ payment_status: "refunded" })).toMatch(/refunded in full/i)
  })

  it("lets a paid order be shipped", () => {
    expect(shipBlocker({ payment_status: "paid" })).toBeNull()
  })
})
