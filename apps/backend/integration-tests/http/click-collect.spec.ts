import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { capturePaymentWorkflow, createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"
import clickCollectLifecycleJob from "../../src/jobs/click-collect-lifecycle"
import { COLLECTION_CODE_ALPHABET, collectLockKey } from "../../src/lib/click-collect"
import orderPlacedCapture from "../../src/subscribers/order-placed-capture"
import { captureDeliveryOrderWorkflow } from "../../src/workflows/capture-delivery-order"
import { markCollectedWorkflow } from "../../src/workflows/mark-collected"
import { markReadyForCollectionWorkflow } from "../../src/workflows/mark-ready-for-collection"
import {
  expireUncollectedOrderWorkflow,
  remindUncollectedOrderWorkflow,
} from "../../src/workflows/uncollected-orders"
import { seedTechNest } from "../../src/scripts/seed"
import { adminHeaders } from "../helpers/auth"
import {
  orderOf,
  paymentOf,
  placeAuthorisedOrder,
  recordEvents,
  settle,
  shippingOptionIdsByCode,
} from "../helpers/orders"
import {
  failNextPaymentCall,
  recordedPaymentCalls,
  resetPaymentRecorder,
} from "../helpers/recording-payment-provider"

process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }
const DAY = 24 * 60 * 60 * 1000

const EVENTS = [
  "technest.order.ready_for_collection",
  "technest.order.collected",
  "technest.order.collection_reminder",
  "technest.payment.capture_failed",
  "order.canceled",
]

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
      events = recordEvents(container, EVENTS)
    })

    beforeEach(() => {
      resetPaymentRecorder()
      events.clear()
    })

    const pickupOrder = () =>
      placeAuthorisedOrder(getContainer(), {
        regionId,
        shippingOptionId: options["click-collect"],
        shippingAmount: 0,
      })
    const captures = () => recordedPaymentCalls().filter((c) => c.method === "capturePayment")
    const post = (url: string) => api.post(url, {}, admin).catch((e: any) => e.response)

    async function backdateReady(orderId: string, daysAgo: number) {
      const orders = getContainer().resolve(Modules.ORDER)
      const order = await orders.retrieveOrder(orderId, { select: ["id", "metadata"] })
      await orders.updateOrders(orderId, {
        metadata: {
          ...order.metadata,
          ready_for_collection_at: new Date(Date.now() - daysAgo * DAY).toISOString(),
        },
      })
    }

    describe("order.placed capture for Click & Collect", () => {
      it("leaves a pickup order authorised", async () => {
        const { order, payment_id } = await pickupOrder()

        await orderPlacedCapture({ event: { name: "order.placed", data: { id: order.id } }, container: getContainer() } as any)

        expect(captures()).toHaveLength(0)
        expect((await paymentOf(getContainer(), payment_id)).captured_at).toBeFalsy()
      })
    })

    describe("POST /admin/click-collect/orders/:id/ready", () => {
      it("stores a 6-character unambiguous code, emits the event once, and is a no-op when repeated", async () => {
        const { order } = await pickupOrder()

        const first = await post(`/admin/click-collect/orders/${order.id}/ready`)
        expect(first.status).toBe(200)
        const card = first.data.order
        expect(card.status).toBe("ready")
        expect(card.collection_code).toMatch(new RegExp(`^[${COLLECTION_CODE_ALPHABET}]{6}$`))
        expect(card.collection_code).not.toMatch(/[01OIL]/)
        expect(card.ready_at).toEqual(expect.any(String))

        const again = await post(`/admin/click-collect/orders/${order.id}/ready`)
        expect(again.status).toBe(200)
        expect(again.data.order.collection_code).toBe(card.collection_code)
        expect(again.data.order.ready_at).toBe(card.ready_at)

        await settle()
        expect(events.for("technest.order.ready_for_collection")).toEqual([
          { name: "technest.order.ready_for_collection", data: { order_id: order.id } },
        ])
        const stored = await orderOf(getContainer(), order.id)
        expect(stored.metadata).toMatchObject({ collection_code: card.collection_code })
      })

      it("emits once and keeps one code when pressed concurrently", async () => {
        const { order } = await pickupOrder()
        const url = `/admin/click-collect/orders/${order.id}/ready`

        const results = await Promise.all([post(url), post(url), post(url)])

        expect(results.map((r) => r.status)).toEqual([200, 200, 200])
        expect(new Set(results.map((r) => r.data.order.collection_code)).size).toBe(1)
        await settle()
        expect(events.for("technest.order.ready_for_collection")).toHaveLength(1)
      })

      it("returns 409 while another action holds the order's lock", async () => {
        const { order } = await pickupOrder()
        const locking = getContainer().resolve(Modules.LOCKING)
        await locking.acquire(collectLockKey(order.id), { ownerId: "test-holder", expire: 60 })
        try {
          const res = await post(`/admin/click-collect/orders/${order.id}/ready`)
          expect(res.status).toBe(409)
        } finally {
          await locking.release(collectLockKey(order.id), { ownerId: "test-holder" })
        }
        await settle()
        expect(events.for("technest.order.ready_for_collection")).toHaveLength(0)
        expect((await post(`/admin/click-collect/orders/${order.id}/ready`)).status).toBe(200)
      })

      it("keeps an existing collection code", async () => {
        const { order } = await pickupOrder()
        await getContainer().resolve(Modules.ORDER).updateOrders(order.id, {
          metadata: { collection_code: "ABC234" },
        })

        const res = await post(`/admin/click-collect/orders/${order.id}/ready`)

        expect(res.data.order.collection_code).toBe("ABC234")
      })

      it("rejects delivery orders, unknown and cancelled orders", async () => {
        const { order: delivery } = await placeAuthorisedOrder(getContainer(), {
          regionId,
          shippingOptionId: options["standard"],
          shippingAmount: 3.49,
        })
        expect((await post(`/admin/click-collect/orders/${delivery.id}/ready`)).status).toBe(400)
        expect((await post(`/admin/click-collect/orders/order_missing/ready`)).status).toBe(404)

        const { order: cancelled } = await pickupOrder()
        await getContainer().resolve(Modules.ORDER).cancel(cancelled.id)
        const res = await post(`/admin/click-collect/orders/${cancelled.id}/ready`)
        expect(res.status).toBe(400)
        expect(res.data.message).toMatch(/cancelled/)
        await settle()
        expect(events.for("technest.order.ready_for_collection")).toHaveLength(0)
      })

      it("needs an admin", async () => {
        const { order } = await pickupOrder()
        const res = await api
          .post(`/admin/click-collect/orders/${order.id}/ready`, {})
          .catch((e: any) => e.response)
        expect(res.status).toBe(401)
      })
    })

    describe("POST /admin/click-collect/orders/:id/collected", () => {
      it("captures once, fulfils and delivers, emits collected once", async () => {
        const { order, payment_id } = await pickupOrder()
        await post(`/admin/click-collect/orders/${order.id}/ready`)

        const res = await post(`/admin/click-collect/orders/${order.id}/collected`)
        expect(res.status).toBe(200)
        expect(res.data.order.status).toBe("collected")
        expect(res.data.order.collected_at).toEqual(expect.any(String))

        const again = await post(`/admin/click-collect/orders/${order.id}/collected`)
        expect(again.status).toBe(200)

        expect(captures()).toHaveLength(1)
        expect((await paymentOf(getContainer(), payment_id)).captured_at).toBeTruthy()
        const stored = await orderOf(getContainer(), order.id)
        expect(stored.fulfillments).toHaveLength(1)
        expect(stored.fulfillments![0]!.delivered_at).toBeTruthy()

        await settle()
        expect(events.for("technest.order.collected")).toEqual([
          { name: "technest.order.collected", data: { order_id: order.id } },
        ])
      })

      it("refuses an order that isn't marked ready", async () => {
        const { order } = await pickupOrder()
        const res = await post(`/admin/click-collect/orders/${order.id}/collected`)
        expect(res.status).toBe(400)
        expect(res.data.message).toMatch(/marked ready/)
        expect(captures()).toHaveLength(0)
      })

      it("surfaces a clear error when a step after capture fails, never refunds, and retries without a second capture", async () => {
        const container = getContainer()
        const { order, payment_id } = await pickupOrder()
        await post(`/admin/click-collect/orders/${order.id}/ready`)

        // Break fulfilment: unlink the pickup fulfillment set from the stock location.
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const { data: sets } = await query.graph({
          entity: "fulfillment_set",
          fields: ["id", "type", "location.id"],
          filters: { type: "pickup" },
        })
        const linkDef = {
          [Modules.STOCK_LOCATION]: { stock_location_id: sets[0].location!.id },
          [Modules.FULFILLMENT]: { fulfillment_set_id: sets[0].id },
        }
        const link = container.resolve(ContainerRegistrationKeys.LINK)
        await link.dismiss(linkDef)

        const failed = await post(`/admin/click-collect/orders/${order.id}/collected`)
        expect(failed.status).toBe(500)
        expect(failed.data.message).toMatch(/^Payment captured but/)
        expect(failed.data.message).toMatch(/Nothing was refunded/)
        expect(captures()).toHaveLength(1)
        expect(recordedPaymentCalls().filter((c) => c.method === "refundPayment")).toHaveLength(0)
        const afterFail = await orderOf(container, order.id)
        expect(afterFail.metadata?.collected_at).toBeUndefined()
        expect((afterFail.fulfillments ?? []).filter((f: any) => !f?.canceled_at)).toHaveLength(0)
        await settle()
        expect(events.for("technest.order.collected")).toHaveLength(0)

        await link.create(linkDef)
        const retried = await post(`/admin/click-collect/orders/${order.id}/collected`)
        expect(retried.status).toBe(200)
        expect(captures()).toHaveLength(1)
        expect((await paymentOf(container, payment_id)).captured_at).toBeTruthy()
        await settle()
        expect(events.for("technest.order.collected")).toHaveLength(1)
      })
    })

    describe("POST /admin/click-collect/orders/:id/collected (edge cases)", () => {
      it("captures once and emits once when pressed concurrently", async () => {
        const { order } = await pickupOrder()
        await post(`/admin/click-collect/orders/${order.id}/ready`)
        const url = `/admin/click-collect/orders/${order.id}/collected`

        const results = await Promise.all([post(url), post(url)])

        expect(results.map((r) => r.status)).toEqual([200, 200])
        expect(results.map((r) => r.data.order.status)).toEqual(["collected", "collected"])
        expect(captures()).toHaveLength(1)
        expect((await orderOf(getContainer(), order.id)).fulfillments).toHaveLength(1)
        await settle()
        expect(events.for("technest.order.collected")).toHaveLength(1)
      })

      it("returns 422 and emits capture_failed when the capture is refused, then succeeds on retry", async () => {
        const { order, payment_id } = await pickupOrder()
        await post(`/admin/click-collect/orders/${order.id}/ready`)
        failNextPaymentCall("capturePayment")

        const failed = await post(`/admin/click-collect/orders/${order.id}/collected`)

        expect(failed.status).toBe(422)
        expect(failed.data.message).toMatch(/^Payment could not be captured/)
        expect(failed.data.message).toMatch(/No money was taken/)
        expect((await paymentOf(getContainer(), payment_id)).captured_at).toBeFalsy()
        const stored = await orderOf(getContainer(), order.id)
        expect(stored.metadata?.collected_at).toBeUndefined()
        expect(stored.fulfillments ?? []).toHaveLength(0)
        await settle()
        expect(events.for("technest.payment.capture_failed")).toEqual([
          { name: "technest.payment.capture_failed", data: { order_id: order.id } },
        ])
        expect(events.for("technest.order.collected")).toHaveLength(0)

        const retried = await post(`/admin/click-collect/orders/${order.id}/collected`)
        expect(retried.status).toBe(200)
        expect(captures()).toHaveLength(1)
        expect((await paymentOf(getContainer(), payment_id)).captured_at).toBeTruthy()
      })

      it("refuses cancelled orders, orders whose authorisation was released, and unknown or delivery orders", async () => {
        const container = getContainer()
        const { order: cancelled } = await pickupOrder()
        await post(`/admin/click-collect/orders/${cancelled.id}/ready`)
        await container.resolve(Modules.ORDER).cancel(cancelled.id)
        const res1 = await post(`/admin/click-collect/orders/${cancelled.id}/collected`)
        expect(res1.status).toBe(400)
        expect(res1.data.message).toMatch(/cancelled/)

        const { order: released, payment_id } = await pickupOrder()
        await post(`/admin/click-collect/orders/${released.id}/ready`)
        await container.resolve(Modules.PAYMENT).cancelPayment(payment_id)
        const res2 = await post(`/admin/click-collect/orders/${released.id}/collected`)
        expect(res2.status).toBe(400)
        expect(res2.data.message).toMatch(/no authorised payment/)

        expect((await post(`/admin/click-collect/orders/order_missing/collected`)).status).toBe(404)
        const { order: delivery } = await placeAuthorisedOrder(container, {
          regionId,
          shippingOptionId: options["standard"],
          shippingAmount: 3.49,
        })
        expect((await post(`/admin/click-collect/orders/${delivery.id}/collected`)).status).toBe(400)

        expect(captures()).toHaveLength(0)
        await settle()
        expect(events.for("technest.order.collected")).toHaveLength(0)
      })

      it("needs an admin", async () => {
        const { order } = await pickupOrder()
        const res = await api
          .post(`/admin/click-collect/orders/${order.id}/collected`, {})
          .catch((e: any) => e.response)
        expect(res.status).toBe(401)
      })
    })

    describe("GET /admin/click-collect/orders", () => {
      it("lists pickup orders per column with the card fields", async () => {
        const toPick = await pickupOrder()
        const ready = await pickupOrder()
        const collected = await pickupOrder()
        await placeAuthorisedOrder(getContainer(), {
          regionId,
          shippingOptionId: options["standard"],
          shippingAmount: 3.49,
        })
        await post(`/admin/click-collect/orders/${ready.order.id}/ready`)
        await post(`/admin/click-collect/orders/${collected.order.id}/ready`)
        await post(`/admin/click-collect/orders/${collected.order.id}/collected`)

        const col = async (status: string) =>
          (await api.get(`/admin/click-collect/orders?status=${status}`, admin)).data

        const pick = await col("to_pick")
        expect(pick.orders.map((o: any) => o.id)).toEqual([toPick.order.id])
        expect(pick.count).toBe(1)
        expect(pick.orders[0]).toEqual({
          id: toPick.order.id,
          display_id: expect.any(Number),
          status: "to_pick",
          collection_code: null,
          customer_name: "Sam Smith",
          items_summary: "2 x USB-C cable (1 m)",
          item_count: 2,
          items: [{ title: "USB-C cable", variant_title: "1 m", quantity: 2 }],
          total_pence: 998,
          created_at: expect.any(String),
          ready_at: null,
          collected_at: null,
          reminder_sent_at: null,
        })

        const readyCol = await col("ready")
        expect(readyCol.orders.map((o: any) => o.id)).toEqual([ready.order.id])
        expect(readyCol.orders[0].collection_code).toHaveLength(6)
        expect(readyCol.orders[0].ready_at).toEqual(expect.any(String))

        const done = await col("collected")
        expect(done.orders.map((o: any) => o.id)).toEqual([collected.order.id])
      })

      it("hides cancelled orders and lists collected orders newest first", async () => {
        const cancelled = await pickupOrder()
        await getContainer().resolve(Modules.ORDER).cancel(cancelled.order.id)
        const first = await pickupOrder()
        const second = await pickupOrder()
        for (const o of [first, second]) {
          await post(`/admin/click-collect/orders/${o.order.id}/ready`)
          await post(`/admin/click-collect/orders/${o.order.id}/collected`)
        }

        const col = async (status: string) =>
          (await api.get(`/admin/click-collect/orders?status=${status}`, admin)).data
        expect((await col("to_pick")).orders).toEqual([])
        const done = await col("collected")
        expect(done.orders.map((o: any) => o.id)).toEqual([second.order.id, first.order.id])
        expect(done.count).toBe(2)
      })

      it("paginates and validates the status", async () => {
        const a = await pickupOrder()
        const b = await pickupOrder()
        const page = (await api.get(`/admin/click-collect/orders?status=to_pick&limit=1&offset=1`, admin)).data
        expect(page).toMatchObject({ count: 2, limit: 1, offset: 1 })
        expect(page.orders.map((o: any) => o.id)).toEqual([b.order.id])
        expect(a.order.id).not.toBe(b.order.id)

        const bad = await api.get(`/admin/click-collect/orders?status=lost`, admin).catch((e: any) => e.response)
        expect(bad.status).toBe(400)
        const missing = await api.get(`/admin/click-collect/orders`, admin).catch((e: any) => e.response)
        expect(missing.status).toBe(400)
      })
    })

    describe("click-collect-lifecycle job", () => {
      it("emits the reminder once after 3 days and leaves younger orders alone", async () => {
        const old = await pickupOrder()
        const fresh = await pickupOrder()
        const notReady = await pickupOrder()
        await post(`/admin/click-collect/orders/${old.order.id}/ready`)
        await post(`/admin/click-collect/orders/${fresh.order.id}/ready`)
        await backdateReady(old.order.id, 3.5)
        await backdateReady(fresh.order.id, 2)

        await clickCollectLifecycleJob(getContainer())
        await clickCollectLifecycleJob(getContainer())
        await settle()

        expect(events.for("technest.order.collection_reminder")).toEqual([
          { name: "technest.order.collection_reminder", data: { order_id: old.order.id } },
        ])
        expect((await orderOf(getContainer(), old.order.id)).metadata?.collection_reminder_sent_at).toEqual(expect.any(String))
        expect((await orderOf(getContainer(), notReady.order.id)).status).not.toBe("canceled")
        expect(recordedPaymentCalls().filter((c) => c.method === "cancelPayment")).toHaveLength(0)
      })

      it("cancels after 7 days, releasing the authorisation once, without refunding", async () => {
        const { order, payment_id } = await pickupOrder()
        const collected = await pickupOrder()
        await post(`/admin/click-collect/orders/${order.id}/ready`)
        await post(`/admin/click-collect/orders/${collected.order.id}/ready`)
        await post(`/admin/click-collect/orders/${collected.order.id}/collected`)
        await backdateReady(order.id, 7.1)
        await backdateReady(collected.order.id, 8)
        resetPaymentRecorder()

        await clickCollectLifecycleJob(getContainer())
        await clickCollectLifecycleJob(getContainer())
        await settle()

        const stored = await orderOf(getContainer(), order.id)
        expect(stored.status).toBe("canceled")
        expect(stored.metadata?.collection_expired_at).toEqual(expect.any(String))
        expect((await paymentOf(getContainer(), payment_id)).canceled_at).toBeTruthy()
        expect(recordedPaymentCalls().map((c) => c.method)).toEqual(["cancelPayment"])
        expect(events.for("order.canceled")).toEqual([{ name: "order.canceled", data: { id: order.id } }])
        expect(events.for("technest.order.collection_reminder")).toHaveLength(0)
        expect((await orderOf(getContainer(), collected.order.id)).status).not.toBe("canceled")

        const col = (await api.get(`/admin/click-collect/orders?status=ready`, admin)).data
        expect(col.orders).toHaveLength(0)
      })

      it("respects the day-3 and day-7 boundaries across hourly runs", async () => {
        const container = getContainer()
        const { order, payment_id } = await pickupOrder()
        await post(`/admin/click-collect/orders/${order.id}/ready`)

        await backdateReady(order.id, 2.9)
        await clickCollectLifecycleJob(container)
        await settle()
        expect(events.for("technest.order.collection_reminder")).toHaveLength(0)

        await backdateReady(order.id, 3.1)
        await clickCollectLifecycleJob(container)
        await backdateReady(order.id, 4)
        await clickCollectLifecycleJob(container)
        await settle()
        expect(events.for("technest.order.collection_reminder")).toEqual([
          { name: "technest.order.collection_reminder", data: { order_id: order.id } },
        ])
        expect((await orderOf(container, order.id)).status).not.toBe("canceled")

        await backdateReady(order.id, 6.9)
        await clickCollectLifecycleJob(container)
        expect((await orderOf(container, order.id)).status).not.toBe("canceled")

        await backdateReady(order.id, 7.05)
        await clickCollectLifecycleJob(container)
        await clickCollectLifecycleJob(container)
        await settle()
        const stored = await orderOf(container, order.id)
        expect(stored.status).toBe("canceled")
        expect(stored.metadata?.collection_expired_at).toEqual(expect.any(String))
        expect((await paymentOf(container, payment_id)).canceled_at).toBeTruthy()
        expect(recordedPaymentCalls().filter((c) => c.method === "cancelPayment")).toHaveLength(1)
        expect(recordedPaymentCalls().filter((c) => c.method === "refundPayment")).toHaveLength(0)
        expect(events.for("order.canceled")).toEqual([{ name: "order.canceled", data: { id: order.id } }])
        expect(events.for("technest.order.collection_reminder")).toHaveLength(1)
      })

      it("never cancels (refunds) an uncollected order whose payment was already captured", async () => {
        const container = getContainer()
        const { order, payment_id } = await pickupOrder()
        await post(`/admin/click-collect/orders/${order.id}/ready`)
        // As left by a Collected press whose fulfilment step failed after the capture.
        await capturePaymentWorkflow(container).run({ input: { payment_id } })
        await backdateReady(order.id, 8)
        resetPaymentRecorder()

        await clickCollectLifecycleJob(container)
        await settle()

        expect((await orderOf(container, order.id)).status).not.toBe("canceled")
        expect(recordedPaymentCalls().map((c) => c.method)).toEqual([])
        expect(events.for("order.canceled")).toHaveLength(0)
      })
    })

    describe("workflows (run directly)", () => {
      it("mark-ready and mark-collected report no-ops on repeat runs", async () => {
        const container = getContainer()
        const { order } = await pickupOrder()

        const r1 = await markReadyForCollectionWorkflow(container).run({ input: { order_id: order.id } })
        const r2 = await markReadyForCollectionWorkflow(container).run({ input: { order_id: order.id } })
        expect([r1.result.already_ready, r2.result.already_ready]).toEqual([false, true])

        const c1 = await markCollectedWorkflow(container).run({ input: { order_id: order.id } })
        const c2 = await markCollectedWorkflow(container).run({ input: { order_id: order.id } })
        expect([c1.result.already_collected, c2.result.already_collected]).toEqual([false, true])
        expect(captures()).toHaveLength(1)
      })

      it("capture-delivery-order skips pickup orders", async () => {
        const { order } = await pickupOrder()
        const { result } = await captureDeliveryOrderWorkflow(getContainer()).run({
          input: { order_id: order.id },
        })
        expect(result).toEqual({ skipped: "pickup", captured_payment_ids: [] })
        expect(captures()).toHaveLength(0)
      })

      it("remind/expire do nothing when not due", async () => {
        const container = getContainer()
        const { order } = await pickupOrder()
        await post(`/admin/click-collect/orders/${order.id}/ready`)

        const remind = await remindUncollectedOrderWorkflow(container).run({ input: { order_id: order.id } })
        const expire = await expireUncollectedOrderWorkflow(container).run({ input: { order_id: order.id } })
        expect(remind.result.reminded).toBe(false)
        expect(expire.result.expired).toBe(false)
        await settle()
        expect(events.for("technest.order.collection_reminder")).toHaveLength(0)
        expect((await orderOf(container, order.id)).status).not.toBe("canceled")
      })

      it("expire retries releasing the authorisation when core's cancel only logged the failure", async () => {
        const container = getContainer()
        const { order, payment_id } = await pickupOrder()
        await post(`/admin/click-collect/orders/${order.id}/ready`)
        await backdateReady(order.id, 7.5)
        failNextPaymentCall("cancelPayment")

        const { result } = await expireUncollectedOrderWorkflow(container).run({
          input: { order_id: order.id },
        })

        expect(result).toEqual({ expired: true, authorisation_released: true })
        expect((await orderOf(container, order.id)).status).toBe("canceled")
        expect((await paymentOf(container, payment_id)).canceled_at).toBeTruthy()
        expect(recordedPaymentCalls().filter((c) => c.method === "cancelPayment")).toHaveLength(1)
        expect(recordedPaymentCalls().filter((c) => c.method === "refundPayment")).toHaveLength(0)
      })

      it("expire rolls back its metadata when the cancel fails", async () => {
        const container = getContainer()
        const { order, payment_id } = await pickupOrder()
        await post(`/admin/click-collect/orders/${order.id}/ready`)
        await backdateReady(order.id, 7.5)
        // Core refuses to cancel an order with an active fulfilment.
        const { data } = await container
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "order", fields: ["items.id"], filters: { id: order.id } })
        await createOrderFulfillmentWorkflow(container).run({
          input: {
            order_id: order.id,
            items: data[0].items!.map((i: any) => ({ id: i.id, quantity: 2 })), // placeAuthorisedOrder: 2 x cable
            no_notification: true,
          },
        })

        const failure = await expireUncollectedOrderWorkflow(container)
          .run({ input: { order_id: order.id } })
          .then(
            () => null,
            (e: unknown) => e
          )
        expect(failure).toBeTruthy()

        const stored = await orderOf(container, order.id)
        expect(stored.status).not.toBe("canceled")
        expect(stored.metadata?.collection_expired_at).toBeUndefined()
        expect(stored.metadata?.ready_for_collection_at).toEqual(expect.any(String))
        expect((await paymentOf(container, payment_id)).canceled_at).toBeFalsy()
        expect(recordedPaymentCalls().filter((c) => c.method === "cancelPayment")).toHaveLength(0)

        // Compensation released the lock: the next run gets past it.
        const again = await expireUncollectedOrderWorkflow(container)
          .run({ input: { order_id: order.id } })
          .catch((e: Error) => e)
        expect((again as Error).message ?? "").not.toMatch(/Failed to acquire lock/)
      })
    })
  },
})
