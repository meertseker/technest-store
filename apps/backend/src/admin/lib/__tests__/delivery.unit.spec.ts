import { deliveryPlace, deliverySummary } from "../delivery"

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
