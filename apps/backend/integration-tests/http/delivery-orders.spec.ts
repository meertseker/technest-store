import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedTechNest } from "../../src/scripts/seed"
import { captureDeliveryOrderWorkflow } from "../../src/workflows/capture-delivery-order"
import { adminHeaders } from "../helpers/auth"
import {
  orderOf,
  placeAuthorisedOrder,
  recordEvents,
  settle,
  shippingOptionIdsByCode,
} from "../helpers/orders"
import { resetPaymentRecorder } from "../helpers/recording-payment-provider"

process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    let regionId: string
    let options: Record<string, string>
    let events: ReturnType<typeof recordEvents>

    beforeAll(async () => {
      const container = getContainer()
      const seeded = await seedTechNest(container)
      regionId = seeded.region.id
      options = await shippingOptionIdsByCode(container)
      admin = await adminHeaders(api, container)
      events = recordEvents(container, ["shipment.created"])
    })

    beforeEach(() => {
      resetPaymentRecorder()
      events.clear()
    })

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
    const ship = (id: string) =>
      api.post(`/admin/delivery-orders/${id}/shipped`, {}, admin).catch((e: any) => e.response)

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

    it("status is required and must be to_pack or shipped; the body must be empty", async () => {
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
