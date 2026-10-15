import { deliveryPlace, deliverySummary, paymentBadge, shipBlocker, trackingInput } from "../delivery"

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

describe("trackingInput", () => {
  it("sends nothing when both fields are empty", () => {
    expect(trackingInput("", "")).toEqual({ ok: true, body: {} })
    expect(trackingInput("  ", " ")).toEqual({ ok: true, body: {} })
  })

  it("sends the number alone, or number and link, trimmed", () => {
    expect(trackingInput(" RM123456789GB ", "")).toEqual({ ok: true, body: { tracking_number: "RM123456789GB" } })
    expect(trackingInput("RM123456789GB", " https://www.royalmail.com/track-your-item#/tracking-results/RM123456789GB ")).toEqual({
      ok: true,
      body: {
        tracking_number: "RM123456789GB",
        tracking_url: "https://www.royalmail.com/track-your-item#/tracking-results/RM123456789GB",
      },
    })
  })

  it("refuses a link without a number, odd characters, and anything but http(s)", () => {
    expect(trackingInput("", "https://x.test/1")).toMatchObject({ ok: false, error: expect.stringMatching(/number/i) })
    expect(trackingInput("RM<script>", "")).toMatchObject({ ok: false, error: expect.stringMatching(/letters, numbers/i) })
    expect(trackingInput("x".repeat(65), "")).toMatchObject({ ok: false })
    expect(trackingInput("RM1", "javascript:alert(1)")).toMatchObject({ ok: false, error: expect.stringMatching(/https/i) })
    expect(trackingInput("RM1", "https://x.test/" + "a".repeat(500))).toMatchObject({ ok: false })
  })

  it("refuses a link with a space inside, as the server does", () => {
    expect(trackingInput("RM1", "https://track.example/RM1 23")).toMatchObject({ ok: false, error: expect.stringMatching(/space/i) })
    expect(trackingInput("RM1", "https://track.example/RM1	23")).toMatchObject({ ok: false })
  })

  it("names both schemes it accepts", () => {
    expect(trackingInput("RM1", "ftp://x.test/1")).toMatchObject({ ok: false, error: expect.stringMatching(/http:\/\/ or https:\/\//) })
    expect(trackingInput("RM1", "http://x.test/1")).toMatchObject({ ok: true })
  })
})
