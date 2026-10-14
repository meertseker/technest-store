import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  createOrderWorkflow,
  updateRegionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { collectLockKey } from "../../src/lib/click-collect"
import { seedTechNest } from "../../src/scripts/seed"
import { captureDeliveryOrderWorkflow } from "../../src/workflows/capture-delivery-order"
import { adminHeaders, storeHeaders } from "../helpers/auth"
import { waitForBackgroundWork } from "../helpers/background"
import {
  orderOf,
  placeAuthorisedOrder,
  recordEvents,
  settle,
  shippingOptionIdsByCode,
  TEST_PROVIDER_ID,
} from "../helpers/orders"
import { recordedPaymentCalls, resetPaymentRecorder } from "../helpers/recording-payment-provider"

process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    let store: Headers
    let regionId: string
    let locationId: string
    let options: Record<string, string>
    let events: ReturnType<typeof recordEvents>
    // A seeded product with tracked stock, for orders placed through the cart.
    let variantId: string
    let inventoryItemId: string

    beforeAll(async () => {
      const container = getContainer()
      const seeded = await seedTechNest(container)
      regionId = seeded.region.id
      locationId = seeded.stockLocation.id
      await updateRegionsWorkflow(container).run({
        input: { selector: { id: regionId }, update: { payment_providers: [TEST_PROVIDER_ID] } },
      })
      options = await shippingOptionIdsByCode(container)
      admin = await adminHeaders(api, container)
      store = await storeHeaders(container)
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product",
        fields: ["variants.id", "variants.manage_inventory", "variants.inventory_items.inventory_item_id"],
        filters: { handle: "clear-shockproof-case" },
      })
      const variant = (data[0] as any).variants[0]
      expect(variant.manage_inventory).toBe(true)
      variantId = variant.id
      inventoryItemId = variant.inventory_items[0].inventory_item_id
      events = recordEvents(container, ["shipment.created"])
      await waitForBackgroundWork(container)
    })

    beforeEach(() => {
      resetPaymentRecorder()
      events.clear()
    })
    afterEach(() => waitForBackgroundWork(getContainer()))

    /** Units on the shelf and units set aside for orders, at the shop. */
    const stock = async () => {
      const [level] = await getContainer()
        .resolve(Modules.INVENTORY)
        .listInventoryLevels({ inventory_item_id: inventoryItemId, location_id: locationId })
      return { on_shelf: Number(level.stocked_quantity), set_aside: Number(level.reserved_quantity) }
    }
    const reservationsOf = async (orderId: string) => {
      const order = await getContainer().resolve(Modules.ORDER).retrieveOrder(orderId, { relations: ["items"] })
      return getContainer()
        .resolve(Modules.INVENTORY)
        .listReservationItems({ line_item_id: (order.items ?? []).map((i) => i.id) })
    }

    /**
     * A delivery order as a shopper places it: cart with a real, tracked variant, address,
     * Standard delivery, payment authorised by the recording provider, completed. The
     * order.placed capture then runs in the background, as in production.
     */
    async function placeDeliveryOrderThroughCart(quantity = 2) {
      const address = { first_name: "Sam", last_name: "Smith", address_1: "1 High St", city: "London", postal_code: "SE16 1AA", country_code: "gb" }
      const { data: created } = await api.post("/store/carts", { region_id: regionId, email: "shopper@example.com" }, store)
      const cartId = created.cart.id as string
      await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantId, quantity }, store)
      await api.post(`/store/carts/${cartId}`, { shipping_address: address, billing_address: address }, store)
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: options["standard"] }, store)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, store)
      await api.post(`/store/payment-collections/${pc.payment_collection.id}/payment-sessions`, { provider_id: TEST_PROVIDER_ID }, store)
      const { data } = await api.post(`/store/carts/${cartId}/complete`, {}, store)
      if (data.type !== "order") throw new Error(`setup: cart did not complete: ${JSON.stringify(data.error ?? data)}`)
      await waitForBackgroundWork(getContainer())
      return data.order.id as string
    }

    const deliveryOrder = () =>
      placeAuthorisedOrder(getContainer(), {
        regionId,
        shippingOptionId: options["standard"],
        shippingAmount: 3.49,
      })
    /** A delivery order as it normally reaches the Delivery tab: payment taken after order.placed. */
    const paidDeliveryOrder = async () => {
      const placed = await deliveryOrder()
      await captureDeliveryOrderWorkflow(getContainer()).run({ input: { order_id: placed.order.id } })
      return placed
    }
    const pickupOrder = () =>
      placeAuthorisedOrder(getContainer(), {
        regionId,
        shippingOptionId: options["click-collect"],
        shippingAmount: 0,
      })
    const list = (status: string) =>
      api.get(`/admin/delivery-orders?status=${status}`, admin).catch((e: any) => e.response)
    const ship = (id: string, body: Record<string, unknown> = {}) =>
      api.post(`/admin/delivery-orders/${id}/shipped`, body, admin).catch((e: any) => e.response)
    const labelsOf = async (orderId: string) => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "order",
        fields: ["fulfillments.id", "fulfillments.labels.tracking_number", "fulfillments.labels.tracking_url"],
        filters: { id: orderId },
      })
      return ((data[0] as any).fulfillments ?? []).flatMap((f: any) => f.labels ?? [])
    }

    it("lists delivery orders to pack, oldest first, never pickup orders", async () => {
      const { order: a } = await deliveryOrder()
      const { order: b } = await deliveryOrder()
      const { order: pickup } = await pickupOrder()

      const { data } = await list("to_pack")
      const ids = data.orders.map((o: any) => o.id)
      expect(ids).toContain(a.id)
      expect(ids).toContain(b.id)
      expect(ids.indexOf(a.id)).toBeLessThan(ids.indexOf(b.id))
      expect(ids).not.toContain(pickup.id)
      expect(data.count).toBeGreaterThanOrEqual(2)

      const row = data.orders.find((o: any) => o.id === a.id)
      expect(row).toMatchObject({
        status: "to_pack",
        shipped_at: null,
        postcode: "SE16 1AA",
        city: "London",
        customer_name: "Sam Smith",
        items: [{ title: "USB-C cable", variant_title: "1 m", quantity: 2 }],
      })
      expect(row.total_pence).toBe(Math.round((2 * 4.99 + 3.49) * 100))
      expect(row.display_id).toEqual(expect.any(Number))
    })

    it("refuses to ship an order whose payment was authorised but never taken, then ships it once it is", async () => {
      const { order } = await deliveryOrder()

      const unpaid = await ship(order.id)
      expect({ status: unpaid.status, message: unpaid.data.message }).toEqual({
        status: 400,
        message: expect.stringMatching(/payment hasn't been taken/),
      })
      await settle()
      expect(events.for("shipment.created")).toHaveLength(0)
      expect((await orderOf(getContainer(), order.id)).fulfillments ?? []).toHaveLength(0)

      await captureDeliveryOrderWorkflow(getContainer()).run({ input: { order_id: order.id } })
      expect((await ship(order.id)).status).toBe(200)
    })

    it("refuses to ship an order that was refunded in full", async () => {
      const { order, amount, payment_id } = await paidDeliveryOrder()
      await api.post(`/admin/payments/${payment_id}/refund`, { amount }, admin)

      const res = await ship(order.id)

      expect({ status: res.status, message: res.data.message }).toEqual({
        status: 400,
        message: expect.stringMatching(/refunded in full/),
      })
      await settle()
      expect(events.for("shipment.created")).toHaveLength(0)
    })

    it("still ships an order that was refunded in part", async () => {
      const { order, payment_id } = await paidDeliveryOrder()
      await api.post(`/admin/payments/${payment_id}/refund`, { amount: 4.99 }, admin)

      expect((await ship(order.id)).status).toBe(200)
    })

    it("marks an order shipped once: fulfilment + shipment, one email event, then a no-op", async () => {
      const { order } = await paidDeliveryOrder()

      const first = await ship(order.id)
      expect(first.status).toBe(200)
      expect(first.data).toMatchObject({ order_id: order.id, already_shipped: false })
      expect(first.data.fulfillment_id).toEqual(expect.any(String))
      await settle()
      expect(events.for("shipment.created")).toHaveLength(1)

      const again = await ship(order.id)
      expect(again.status).toBe(200)
      expect(again.data).toEqual({
        order_id: order.id,
        fulfillment_id: first.data.fulfillment_id,
        already_shipped: true,
      })
      await settle()
      expect(events.for("shipment.created")).toHaveLength(1)

      const { data: shipped } = await list("shipped")
      const row = shipped.orders.find((o: any) => o.id === order.id)
      expect(row).toMatchObject({ status: "shipped" })
      expect(row.shipped_at).toEqual(expect.any(String))
      const { data: toPack } = await list("to_pack")
      expect(toPack.orders.map((o: any) => o.id)).not.toContain(order.id)
    })

    it("shows on each row whether the payment was taken", async () => {
      const { order: unpaid } = await deliveryOrder()
      const { order: paid } = await paidDeliveryOrder()

      const { data } = await list("to_pack")
      const row = (id: string) => data.orders.find((o: any) => o.id === id)
      expect(row(unpaid.id)).toMatchObject({ payment_status: "not_taken", partly_shipped: false })
      expect(row(paid.id)).toMatchObject({ payment_status: "paid", partly_shipped: false })
    })

    it("ships an order that was packed on Medusa's order page but never marked shipped", async () => {
      const { order } = await paidDeliveryOrder()
      const { result: packed } = await createOrderFulfillmentWorkflow(getContainer()).run({
        input: { order_id: order.id, items: [{ id: order.items![0].id, quantity: 2 }], no_notification: true },
      })

      // Everything is fulfilled, nothing has left: it is still to pack.
      expect((await list("to_pack")).data.orders.map((o: any) => o.id)).toContain(order.id)
      expect((await list("shipped")).data.orders.map((o: any) => o.id)).not.toContain(order.id)

      const res = await ship(order.id)
      expect(res.status).toBe(200)
      expect(res.data).toEqual({ order_id: order.id, fulfillment_id: packed.id, already_shipped: false })
      await settle()
      expect(events.for("shipment.created")).toEqual([
        { name: "shipment.created", data: { id: packed.id, no_notification: false } },
      ])

      expect((await list("shipped")).data.orders.map((o: any) => o.id)).toContain(order.id)
      expect((await list("to_pack")).data.orders.map((o: any) => o.id)).not.toContain(order.id)
      expect((await ship(order.id)).data).toMatchObject({ already_shipped: true, fulfillment_id: packed.id })
    })

    it("keeps a partly shipped order in to-pack and ships the rest", async () => {
      const { order } = await paidDeliveryOrder()
      const item = order.items![0].id
      const { result: first } = await createOrderFulfillmentWorkflow(getContainer()).run({
        input: { order_id: order.id, items: [{ id: item, quantity: 1 }], no_notification: true },
      })
      await createOrderShipmentWorkflow(getContainer()).run({
        input: { order_id: order.id, fulfillment_id: first.id, items: [{ id: item, quantity: 1 }], no_notification: true },
      })
      await settle()
      events.clear()

      const { data: toPack } = await list("to_pack")
      expect(toPack.orders.find((o: any) => o.id === order.id)).toMatchObject({
        status: "to_pack",
        partly_shipped: true,
        shipped_at: null,
      })
      expect((await list("shipped")).data.orders.map((o: any) => o.id)).not.toContain(order.id)

      const res = await ship(order.id)
      expect(res.status).toBe(200)
      expect(res.data.already_shipped).toBe(false)
      expect(res.data.fulfillment_id).not.toBe(first.id)
      await settle()
      // One more parcel, one more email.
      expect(events.for("shipment.created")).toHaveLength(1)

      const { data: shipped } = await list("shipped")
      expect(shipped.orders.find((o: any) => o.id === order.id)).toMatchObject({
        status: "shipped",
        partly_shipped: false,
        shipped_at: expect.any(String),
      })
    })

    it("does not list an order without a shipping method, and refuses to mark it shipped", async () => {
      const { result: order } = await createOrderWorkflow(getContainer()).run({
        input: {
          region_id: regionId,
          email: "counter-sale@example.com",
          currency_code: "gbp",
          items: [{ title: "Screen protector", quantity: 1, unit_price: 0, is_tax_inclusive: true }],
        },
      })

      expect((await list("to_pack")).data.orders.map((o: any) => o.id)).not.toContain(order.id)
      const res = await ship(order.id)
      expect({ status: res.status, message: res.data.message }).toEqual({
        status: 400,
        message: expect.stringMatching(/no delivery method/),
      })
      await settle()
      expect(events.for("shipment.created")).toHaveLength(0)
    })

    it("keeps an old unpacked order on the list however many newer orders there are", async () => {
      const { order: forgotten } = await deliveryOrder()
      // More newer orders than one read of the order table returns. The first one
      // alone, so the guest customer exists before ten are created at once.
      const later = (n: number) =>
        Array.from({ length: n }, () =>
          createOrderWorkflow(getContainer()).run({
            input: {
              region_id: regionId,
              email: "later@example.com",
              currency_code: "gbp",
              items: [{ title: "Cable", quantity: 1, unit_price: 1, is_tax_inclusive: true }],
              shipping_methods: [
                { name: "Shipping", amount: 0, shipping_option_id: options["click-collect"], is_tax_inclusive: true },
              ],
            },
          })
        )
      await Promise.all(later(1))
      for (let batch = 0; batch < 21; batch++) {
        await Promise.all(later(10))
      }
      const { data } = await list("to_pack")
      expect(data.orders[0].id).toBe(forgotten.id)
      expect(data.count).toBe(1)
    })

    it("an order placed through the shop: paid on placing, units set aside, then taken off the shelf when shipped", async () => {
      const before = await stock()
      const orderId = await placeDeliveryOrderThroughCart(2)

      // Placing it took the money (order.placed capture) and set the units aside.
      expect(recordedPaymentCalls().filter((c) => c.method === "capturePayment")).toHaveLength(1)
      expect(await stock()).toEqual({ on_shelf: before.on_shelf, set_aside: before.set_aside + 2 })
      expect(await reservationsOf(orderId)).toHaveLength(1)
      const { data: toPack } = await list("to_pack")
      expect(toPack.orders.find((o: any) => o.id === orderId)).toMatchObject({ payment_status: "paid" })

      const res = await ship(orderId)
      expect(res.status).toBe(200)
      await settle()
      expect(events.for("shipment.created")).toHaveLength(1)
      expect(await stock()).toEqual({ on_shelf: before.on_shelf - 2, set_aside: before.set_aside })
      expect(await reservationsOf(orderId)).toHaveLength(0)
      expect((await list("shipped")).data.orders.map((o: any) => o.id)).toContain(orderId)
    })

    it("two presses at once ship once: one does the work, the other waits and no-ops", async () => {
      const { order } = await paidDeliveryOrder()

      const [a, b] = await Promise.all([ship(order.id), ship(order.id)])

      expect([a.status, b.status]).toEqual([200, 200])
      expect([a.data.already_shipped, b.data.already_shipped].sort()).toEqual([false, true])
      expect(a.data.fulfillment_id).toBe(b.data.fulfillment_id)
      await settle()
      expect(events.for("shipment.created")).toHaveLength(1)
      const live = ((await orderOf(getContainer(), order.id)).fulfillments ?? []).filter((f: any) => !f.canceled_at)
      expect(live).toHaveLength(1)
    })

    it("a failure after packing but before the shipment undoes the packing: nothing ships, stock is untouched", async () => {
      const before = await stock()
      const orderId = await placeDeliveryOrderThroughCart(1)
      const fulfillment = getContainer().resolve(Modules.FULFILLMENT) as any
      const spy = jest.spyOn(fulfillment, "updateFulfillment").mockRejectedValueOnce(new Error("carrier system down"))
      try {
        const res = await ship(orderId)
        expect(res.status).toBeGreaterThanOrEqual(400)
      } finally {
        spy.mockRestore()
      }
      await settle()
      expect(events.for("shipment.created")).toHaveLength(0)
      const live = ((await orderOf(getContainer(), orderId)).fulfillments ?? []).filter((f: any) => !f.canceled_at)
      expect(live).toHaveLength(0)
      expect(await stock()).toEqual({ on_shelf: before.on_shelf, set_aside: before.set_aside + 1 })
      expect(await reservationsOf(orderId)).toHaveLength(1)
      expect((await list("to_pack")).data.orders.map((o: any) => o.id)).toContain(orderId)

      // The next press, with the carrier back, ships it.
      expect((await ship(orderId)).status).toBe(200)
      expect(await stock()).toEqual({ on_shelf: before.on_shelf - 1, set_aside: before.set_aside })
    })

    it("answers 409 while the order's payment is being taken", async () => {
      const { order } = await paidDeliveryOrder()
      await getContainer()
        .resolve(Modules.LOCKING)
        .acquire(collectLockKey(order.id), { ownerId: "a-capture-in-flight", expire: 60 })

      const res = await ship(order.id)

      expect(res.status).toBe(409)
      expect(res.data.message).toMatch(/being updated/)
      await settle()
      expect(events.for("shipment.created")).toHaveLength(0)
    })

    it("needs an admin", async () => {
      const { order } = await paidDeliveryOrder()
      const anonymousList = await api.get("/admin/delivery-orders?status=to_pack").catch((e: any) => e.response)
      const anonymousShip = await api
        .post(`/admin/delivery-orders/${order.id}/shipped`, {})
        .catch((e: any) => e.response)
      expect(anonymousList.status).toBe(401)
      expect(anonymousShip.status).toBe(401)
      expect((await orderOf(getContainer(), order.id)).fulfillments ?? []).toHaveLength(0)
    })

    it("refuses a cancelled order even after it shipped", async () => {
      const { order } = await paidDeliveryOrder()
      await getContainer().resolve(Modules.ORDER).updateOrders([{ id: order.id, status: "canceled" } as any])
      const res = await ship(order.id)
      expect({ status: res.status, message: res.data.message }).toEqual({
        status: 400,
        message: expect.stringMatching(/is cancelled/),
      })
    })

    it("refuses a Click & Collect order", async () => {
      const { order: pickup } = await pickupOrder()
      const res = await ship(pickup.id)
      expect(res.status).toBe(400)
      expect(res.data.message).toMatch(/Click & Collect/)
      expect(events.for("shipment.created")).toHaveLength(0)
    })

    it("404s an unknown order", async () => {
      const res = await ship("order_does_not_exist")
      expect(res.status).toBe(404)
    })

    it("puts the tracking number and link on the parcel, where the dispatched email reads them", async () => {
      const { order } = await paidDeliveryOrder()
      const res = await ship(order.id, {
        tracking_number: "RM 123456789 GB",
        tracking_url: "https://www.royalmail.com/track-your-item#/tracking-results/RM123456789GB",
      })
      expect(res.status).toBe(200)
      expect(await labelsOf(order.id)).toEqual([
        expect.objectContaining({
          tracking_number: "RM 123456789 GB",
          tracking_url: "https://www.royalmail.com/track-your-item#/tracking-results/RM123456789GB",
        }),
      ])
      await settle()
      expect(events.for("shipment.created")).toHaveLength(1)
    })

    it("ships without tracking, and with a number but no link", async () => {
      const { order } = await paidDeliveryOrder()
      expect((await ship(order.id, { tracking_number: "ABC-123" })).status).toBe(200)
      expect(await labelsOf(order.id)).toEqual([expect.objectContaining({ tracking_number: "ABC-123" })])
      const { order: plain } = await paidDeliveryOrder()
      expect((await ship(plain.id)).status).toBe(200)
      expect(await labelsOf(plain.id)).toEqual([])
    })

    it("refuses a tracking link that is not http(s), a bad number, or a link without a number; nothing ships", async () => {
      const { order } = await paidDeliveryOrder()
      for (const body of [
        { tracking_number: "RM1", tracking_url: "javascript:alert(1)" },
        { tracking_number: "RM1", tracking_url: "ftp://x.test/1" },
        { tracking_number: "RM1", tracking_url: "www.royalmail.com/track" },
        { tracking_number: "RM1", tracking_url: "https://x.test/" + "a".repeat(500) },
        { tracking_number: "<b>1</b>" },
        { tracking_number: "x".repeat(65) },
        { tracking_number: "" },
        { tracking_url: "https://x.test/1" },
        { tracking_number: 123 },
      ]) {
        const res = await ship(order.id, body)
        expect([body, res.status]).toEqual([body, 400])
      }
      await settle()
      expect(events.for("shipment.created")).toHaveLength(0)
      expect((await orderOf(getContainer(), order.id)).fulfillments ?? []).toHaveLength(0)
    })

    it("status is required and must be to_pack or shipped; the body takes only tracking fields", async () => {
      expect((await list("packed")).status).toBe(400)
      expect((await api.get("/admin/delivery-orders", admin).catch((e: any) => e.response)).status).toBe(400)
      const { order } = await deliveryOrder()
      const res = await api
        .post(`/admin/delivery-orders/${order.id}/shipped`, { tracking: "x" }, admin)
        .catch((e: any) => e.response)
      expect(res.status).toBe(400)
    })
  },
})
