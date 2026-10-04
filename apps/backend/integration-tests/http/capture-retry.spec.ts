// A delivery order is captured right after order.placed. When that capture fails, or the event never
// arrives, the capture-retry job takes the payment later; the shopper is only told once it gives up.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import {
  CAPTURE_RETRY_AFTER_MS,
  CAPTURE_RETRY_MAX_ATTEMPTS,
  CaptureRetryMeta,
  retryUncapturedDeliveryOrders,
} from "../../src/lib/capture-retry"
import { collectLockKey } from "../../src/lib/click-collect"
import orderPlacedCapture from "../../src/subscribers/order-placed-capture"
import { seedTechNest } from "../../src/scripts/seed"
import { orderOf, paymentOf, placeAuthorisedOrder, recordEvents, settle, shippingOptionIdsByCode } from "../helpers/orders"
import {
  failNextPaymentCall,
  recordedPaymentCalls,
  resetPaymentRecorder,
} from "../helpers/recording-payment-provider"

process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"

jest.setTimeout(10 * 60 * 1000)

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    let regionId: string
    let options: Record<string, string>
    let events: ReturnType<typeof recordEvents>

    beforeAll(async () => {
      const container = getContainer()
      regionId = (await seedTechNest(container)).region.id
      options = await shippingOptionIdsByCode(container)
      events = recordEvents(container, ["technest.payment.capture_failed"])
    })

    beforeEach(async () => {
      // Earlier tests leave uncaptured orders behind: take them out of the job's reach.
      const orders = getContainer().resolve(Modules.ORDER)
      for (const order of await orders.listOrders({}, { select: ["id"] })) {
        await orders.cancel(order.id)
      }
      resetPaymentRecorder()
      events.clear()
    })

    const order = (code: "standard" | "click-collect" = "standard") =>
      placeAuthorisedOrder(getContainer(), {
        regionId,
        shippingOptionId: options[code],
        shippingAmount: code === "standard" ? 3.49 : 0,
      })
    const placed = (id: string) =>
      orderPlacedCapture({ event: { name: "order.placed", data: { id } }, container: getContainer() } as any)
    /** Successful captures (the recorder doesn't list a call it was told to refuse). */
    const captures = () => recordedPaymentCalls().filter((c) => c.method === "capturePayment").length
    const attemptsOn = async (orderId: string) =>
      ((await orderOf(getContainer(), orderId)).metadata ?? {})[CaptureRetryMeta.ATTEMPTS] ?? 0
    const capturedAt = async (paymentId: string) => (await paymentOf(getContainer(), paymentId)).captured_at
    /** Runs the job as if it were `ms` after now. */
    const sweep = (ms: number) => retryUncapturedDeliveryOrders(getContainer(), new Date(Date.now() + ms))
    const failedEvents = async () => {
      await settle()
      return events.for("technest.payment.capture_failed")
    }

    it("a capture refused on order.placed is retried by the job, and the shopper is not told meanwhile", async () => {
      const { order: o, payment_id } = await order()
      failNextPaymentCall("capturePayment")
      await placed(o.id)
      expect(await capturedAt(payment_id)).toBeFalsy()
      expect(await failedEvents()).toEqual([])

      const result = await sweep(CAPTURE_RETRY_AFTER_MS + MINUTE)

      expect(result).toMatchObject({ captured: 1, failed: 0, gave_up: 0 })
      expect(await capturedAt(payment_id)).toBeTruthy()
      expect(await failedEvents()).toEqual([])
    })

    it("captures an order whose order.placed event never arrived, but not before it is old enough", async () => {
      const { payment_id } = await order()

      expect(await sweep(CAPTURE_RETRY_AFTER_MS - MINUTE)).toMatchObject({ captured: 0 })
      expect(captures()).toBe(0)

      expect(await sweep(CAPTURE_RETRY_AFTER_MS + MINUTE)).toMatchObject({ captured: 1 })
      expect(await capturedAt(payment_id)).toBeTruthy()
    })

    it("backs off between attempts, gives up after the last one and tells the shop and shopper once", async () => {
      const { order: o, payment_id } = await order()

      // Straight after a failed attempt the next run leaves the order alone.
      failNextPaymentCall("capturePayment")
      expect(await sweep(CAPTURE_RETRY_AFTER_MS + MINUTE)).toMatchObject({ failed: 1, gave_up: 0 })
      expect(await sweep(CAPTURE_RETRY_AFTER_MS + 2 * MINUTE)).toMatchObject({ captured: 0, failed: 0 })
      expect(await attemptsOn(o.id)).toBe(1)

      // A day apart is past any backoff.
      for (let attempt = 2; attempt <= CAPTURE_RETRY_MAX_ATTEMPTS; attempt++) {
        expect(await failedEvents()).toEqual([])
        failNextPaymentCall("capturePayment")
        await sweep(attempt * DAY)
      }

      expect(await failedEvents()).toEqual([
        { name: "technest.payment.capture_failed", data: { order_id: o.id } },
      ])
      const metadata = (await orderOf(getContainer(), o.id)).metadata ?? {}
      expect(metadata[CaptureRetryMeta.ATTEMPTS]).toBe(CAPTURE_RETRY_MAX_ATTEMPTS)
      expect(metadata[CaptureRetryMeta.GAVE_UP_AT]).toBeTruthy()

      // Given up: later runs don't touch it and don't tell anyone again.
      events.clear()
      expect(await sweep(7 * DAY)).toMatchObject({ captured: 0, failed: 0, gave_up: 0 })
      expect(await attemptsOn(o.id)).toBe(CAPTURE_RETRY_MAX_ATTEMPTS)
      expect(await failedEvents()).toEqual([])
      expect(captures()).toBe(0)
      expect(await capturedAt(payment_id)).toBeFalsy()
    })

    it("leaves Click & Collect and cancelled orders alone", async () => {
      await order("click-collect")
      const cancelled = await order()
      await getContainer().resolve(Modules.ORDER).cancel(cancelled.order.id)

      expect(await sweep(DAY)).toMatchObject({ captured: 0, failed: 0, gave_up: 0 })
      expect(captures()).toBe(0)
    })

    it("order.placed fails loudly when the order's lock is held, so the event is retried", async () => {
      const { order: o } = await order()
      const locking = getContainer().resolve(Modules.LOCKING)
      await locking.acquire(collectLockKey(o.id), { ownerId: "a-worker-that-died", expire: 60 })

      try {
        await expect(placed(o.id)).rejects.toMatchObject({ message: expect.stringMatching(/lock/i) })
      } finally {
        await locking.release(collectLockKey(o.id), { ownerId: "a-worker-that-died" })
      }
      expect(captures()).toBe(0)
    })
  },
})
