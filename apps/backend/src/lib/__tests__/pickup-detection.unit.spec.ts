import { isPickupOption } from "../basket-rules"
import { isPickupOrder } from "../email/order-email-data"

/**
 * Click & Collect is detected in two places: the basket rule (which shipping
 * options count as pickup) and the order side (capture, emails, the board).
 * Both must agree, so both go through `isPickupOption`.
 */
describe("pickup detection", () => {
  const graph = jest.fn()
  const container = { resolve: () => ({ graph }) } as any

  beforeEach(() => graph.mockReset())

  it("treats a native pickup fulfillment set as Click & Collect", async () => {
    const row = { id: "so_1", type: { code: "collect" }, service_zone: { fulfillment_set: { type: "pickup" } } }
    expect(isPickupOption(row)).toBe(true)
    graph.mockResolvedValue({ data: [row] })
    await expect(isPickupOrder(container, ["so_1"])).resolves.toBe(true)
  })

  it("treats the click-collect option type as Click & Collect on the order side too", async () => {
    const row = { id: "so_1", type: { code: "click-collect" }, service_zone: { fulfillment_set: { type: "shipping" } } }
    expect(isPickupOption(row)).toBe(true)
    graph.mockResolvedValue({ data: [row] })
    await expect(isPickupOrder(container, ["so_1"])).resolves.toBe(true)
    expect(graph.mock.calls[0][0].fields).toEqual(expect.arrayContaining(["type.code", "service_zone.fulfillment_set.type"]))
  })

  it("is false for delivery options and for orders without a shipping method", async () => {
    const row = { id: "so_2", type: { code: "standard" }, service_zone: { fulfillment_set: { type: "shipping" } } }
    expect(isPickupOption(row)).toBe(false)
    graph.mockResolvedValue({ data: [row] })
    await expect(isPickupOrder(container, ["so_2"])).resolves.toBe(false)
    await expect(isPickupOrder(container, [null, undefined])).resolves.toBe(false)
    expect(graph).toHaveBeenCalledTimes(1)
  })
})
