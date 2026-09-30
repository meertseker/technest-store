import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import orderPlacedCapture from "../../src/subscribers/order-placed-capture"
import { seedTechNest } from "../../src/scripts/seed"
import { adminHeaders } from "../helpers/auth"
import {
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
      events = recordEvents(container, ["technest.payment.capture_failed", "payment.refunded", "payment.captured"])
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
    const placed = (id: string) =>
      orderPlacedCapture({ event: { name: "order.placed", data: { id } }, container: getContainer() } as any)
    const calls = (method: string) => recordedPaymentCalls().filter((c) => c.method === method)

    describe("order.placed capture (delivery)", () => {
      it("captures a delivery order", async () => {
        const { order, payment_id } = await deliveryOrder()

        await placed(order.id)

        expect(calls("capturePayment")).toHaveLength(1)
        expect((await paymentOf(getContainer(), payment_id)).captured_at).toBeTruthy()
        await settle()
        expect(events.for("payment.captured", { id: payment_id })).toHaveLength(1)
      })

      it("never double-captures on duplicate or concurrent order.placed events", async () => {
        const { order, payment_id } = await deliveryOrder()

        await Promise.all([placed(order.id), placed(order.id)])
        await placed(order.id)

        expect(calls("capturePayment")).toHaveLength(1)
        expect((await paymentOf(getContainer(), payment_id)).captures).toHaveLength(1)
        await settle()
        expect(events.for("technest.payment.capture_failed")).toHaveLength(0)
      })

      it("emits technest.payment.capture_failed when the provider refuses the capture", async () => {
        const { order, payment_id } = await deliveryOrder()
        failNextPaymentCall("capturePayment")

        await placed(order.id)

        expect((await paymentOf(getContainer(), payment_id)).captured_at).toBeFalsy()
        await settle()
        expect(events.for("technest.payment.capture_failed")).toEqual([
          { name: "technest.payment.capture_failed", data: { order_id: order.id } },
        ])
      })
    })

    describe("order.placed capture (skips)", () => {
      it("leaves cancelled delivery orders alone and ignores unknown orders, without emitting", async () => {
        const { order, payment_id } = await deliveryOrder()
        await getContainer().resolve(Modules.ORDER).cancel(order.id)

        await placed(order.id)
        await placed("order_missing")

        expect(calls("capturePayment")).toHaveLength(0)
        expect((await paymentOf(getContainer(), payment_id)).captured_at).toBeFalsy()
        await settle()
        expect(events.for("technest.payment.capture_failed")).toHaveLength(0)
      })
    })

    describe("refunds from the admin order page (POST /admin/payments/:id/refund)", () => {
      it("refunds a captured payment partially, then fully, and never more than captured", async () => {
        const { order, payment_id, amount } = await deliveryOrder()
        await placed(order.id)

        const partial = await api.post(`/admin/payments/${payment_id}/refund`, { amount: 5 }, admin)
        expect(partial.status).toBe(200)
        const rest = Math.round((amount - 5) * 100) / 100
        const full = await api.post(`/admin/payments/${payment_id}/refund`, { amount: rest }, admin)
        expect(full.status).toBe(200)

        expect(calls("refundPayment").map((c) => c.amount)).toEqual([5, rest])
        const refunds = (await paymentOf(getContainer(), payment_id)).refunds ?? []
        expect(refunds.map((r: any) => Number(r.amount)).sort()).toEqual([5, rest].sort())

        const over = await api
          .post(`/admin/payments/${payment_id}/refund`, { amount: 1 }, admin)
          .catch((e: any) => e.response)
        expect(over.status).toBe(400)
        expect(calls("refundPayment")).toHaveLength(2)

        await settle()
        expect(events.for("payment.refunded", { id: payment_id })).toHaveLength(2)
      })

      it("refuses to refund an authorised-only payment", async () => {
        const { payment_id } = await placeAuthorisedOrder(getContainer(), {
          regionId,
          shippingOptionId: options["click-collect"],
          shippingAmount: 0,
        })
        const res = await api
          .post(`/admin/payments/${payment_id}/refund`, { amount: 1 }, admin)
          .catch((e: any) => e.response)
        expect(res.status).toBe(400)
        expect(calls("refundPayment")).toHaveLength(0)
      })
    })
  },
})
