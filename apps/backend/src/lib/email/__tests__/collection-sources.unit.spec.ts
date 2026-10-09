import { collectionDeadline } from "../../click-collect/deadline"
import { holdUntil, paymentFailed } from "../collection-sources"

/** A container whose query.graph returns the order, and the given type for its shipping option. */
function containerWithOrder(fulfilmentSetType: "pickup" | "shipping") {
  const order = {
    id: "order_1",
    display_id: 1042,
    email: "sam@example.com",
    total: 14.47,
    metadata: {},
    created_at: "2026-10-02T09:00:00.000Z",
    customer: { first_name: "Sam" },
    shipping_methods: [{ shipping_option_id: "so_1" }],
    items: [],
  }
  const graph = jest.fn(async ({ entity }: { entity: string }) => ({
    data:
      entity === "order"
        ? [order]
        : [{ id: "so_1", service_zone: { fulfillment_set: { type: fulfilmentSetType } } }],
  }))
  return { resolve: () => ({ graph }) } as any
}

describe("paymentFailed", () => {
  beforeEach(() => {
    process.env.SHOP_NOTIFY_EMAIL = "shop@technest.test"
  })

  // Click & Collect is charged at the counter; the email must not say "we haven't sent it".
  it("says whether the order was for collection or delivery, for the customer and the shop", async () => {
    const pickup = await paymentFailed(containerWithOrder("pickup"), "order_1", "customer")
    expect(pickup).toMatchObject({
      to: "sam@example.com",
      data: { display_id: 1042, total_pence: 1447, for_shop: false, fulfilment: "collection" },
    })
    const shop = await paymentFailed(containerWithOrder("pickup"), "order_1", "shop")
    expect(shop).toMatchObject({ to: "shop@technest.test", data: { for_shop: true, fulfilment: "collection" } })

    const delivery = await paymentFailed(containerWithOrder("shipping"), "order_1", "customer")
    expect(delivery?.data).toMatchObject({ fulfilment: "delivery" })
  })
})

describe("holdUntil", () => {
  // The date in the email is the day the lifecycle job cancels at the end of.
  it("is the collection deadline as a London date", () => {
    const order = { created_at: "2026-10-02T09:00:00.000Z", ready_at: "2026-10-02T10:00:00.000Z" }

    // Ordered Friday 2 October 10:00 London: the card authorisation lapses Friday 9th in the morning.
    expect(holdUntil(order)).toBe("Thursday 8 October")
    const deadline = collectionDeadline({
      ordered_at: Date.parse(order.created_at),
      ready_at: Date.parse(order.ready_at),
    })
    expect(new Date(deadline).toISOString()).toBe("2026-10-08T22:59:59.999Z")
  })

  it("is null without usable dates", () => {
    expect(holdUntil({ created_at: undefined, ready_at: "2026-10-02T10:00:00.000Z" })).toBeNull()
    expect(holdUntil({ created_at: "2026-10-02T09:00:00.000Z", ready_at: "not a date" })).toBeNull()
  })
})
