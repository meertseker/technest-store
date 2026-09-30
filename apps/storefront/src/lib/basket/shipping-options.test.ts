import { describe, expect, it } from "vitest"
import { cheapestDeliveryPence, deliveryKind, groupDeliveryChoices } from "./shipping-options"

// Shapes as returned by GET /store/shipping-options?cart_id= on the seeded backend
const standard = {
  id: "so_std",
  name: "Standard delivery",
  amount: 3.49,
  calculated_price: { calculated_amount: 3.49 },
  type: { code: "standard", description: "Royal Mail, 2-3 working days." },
  service_zone: { fulfillment_set: { type: "shipping" } },
}
const collect = {
  id: "so_cc",
  name: "Click & Collect – Free in-store pickup",
  amount: 0,
  type: { code: "click-collect", description: "Free." },
  service_zone: { fulfillment_set: { type: "pickup" } },
}
const nextDay = {
  id: "so_nd",
  name: "Next-day delivery",
  amount: 5.99,
  type: { code: "next-day", description: null },
  service_zone: { fulfillment_set: { type: "shipping" } },
}

describe("shipping options", () => {
  it("detects the kind from the pickup set, type code, then name", () => {
    expect(deliveryKind(collect)).toBe("collect")
    expect(deliveryKind(nextDay)).toBe("next-day")
    expect(deliveryKind({ id: "x", name: "Next day tracked" })).toBe("next-day")
    expect(deliveryKind({ id: "x", name: "Courier" })).toBeNull()
  })

  it("orders choices collect, standard, next-day with Medusa prices", () => {
    const choices = groupDeliveryChoices([nextDay, standard, collect])
    expect(choices.map((c) => c.kind)).toEqual(["collect", "standard", "next-day"])
    expect(choices[1]).toMatchObject({ amount: 3.49, amount_pence: 349, id: "so_std" })
  })

  it("prefers calculated_price (e.g. free standard over the threshold)", () => {
    const free = { ...standard, calculated_price: { calculated_amount: 0 } }
    expect(groupDeliveryChoices([free])[0].amount_pence).toBe(0)
  })

  it("finds the cheapest home delivery, ignoring collection", () => {
    expect(cheapestDeliveryPence(groupDeliveryChoices([collect, standard, nextDay]))).toBe(349)
    expect(cheapestDeliveryPence(groupDeliveryChoices([collect]))).toBeNull()
  })
})
