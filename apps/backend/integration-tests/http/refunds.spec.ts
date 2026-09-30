import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { seedTechNest } from "../../src/scripts/seed"
import { adminHeaders } from "../helpers/auth"
import {
  paymentOf,
  placeAuthorisedOrder,
  recordEvents,
  settle,
  shippingOptionIdsByCode,
} from "../helpers/orders"
import { recordedPaymentCalls, resetPaymentRecorder } from "../helpers/recording-payment-provider"

process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

/**
 * Refunds use Medusa's stock admin route (POST /admin/payments/:id/refund,
 * the "Refund" action on the admin order page). These tests pin the Tech Nest
 * rules on top of capture: false (docs/contracts/payments.md).
 */
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
      events = recordEvents(container, ["payment.refunded"])
    })

    beforeEach(() => {
      resetPaymentRecorder()
      events.clear()
    })

    const refunds = () => recordedPaymentCalls().filter((c) => c.method === "refundPayment")

    /** Authorised order (capture: false), captured the way E2's flows do it. */
    const capturedOrder = async (kind: "standard" | "click-collect") => {
      const placed = await placeAuthorisedOrder(getContainer(), {
        regionId,
        shippingOptionId: options[kind],
        shippingAmount: kind === "standard" ? 3.49 : 0,
      })
      await capturePaymentWorkflow(getContainer()).run({ input: { payment_id: placed.payment_id } })
      resetPaymentRecorder()
      return placed
    }

    const refund = (paymentId: string, body: Record<string, unknown> = {}) =>
      api.post(`/admin/payments/${paymentId}/refund`, body, admin).catch((e: any) => e.response)

    describe("POST /admin/payments/:id/refund (Medusa's native route)", () => {
      it("partially then fully refunds a captured delivery order, one payment.refunded per refund", async () => {
        const { payment_id, amount } = await capturedOrder("standard")
        expect(amount).toBe(13.47) // 2 x £4.99 + £3.49 delivery

        const partial = await refund(payment_id, { amount: 4.99, note: "one cable faulty" })
        expect(partial.status).toBe(200)
        const rest = await refund(payment_id, { amount: 8.48 })
        expect(rest.status).toBe(200)

        // Major units, as Medusa stores them; the Stripe provider converts to pence.
        expect(refunds().map((c) => c.amount)).toEqual([4.99, 8.48])
        const payment = await paymentOf(getContainer(), payment_id)
        expect(payment.refunds.map((r: any) => Number(r.amount)).sort()).toEqual([4.99, 8.48])

        await settle()
        // The refund-issued email subscriber listens to exactly this (docs/contracts/emails.md #8).
        expect(events.for("payment.refunded", { id: payment_id })).toHaveLength(2)
      })

      it("refunds a captured Click & Collect order in full when no amount is given", async () => {
        const { payment_id, amount } = await capturedOrder("click-collect")

        const res = await refund(payment_id)

        expect(res.status).toBe(200)
        expect(refunds()).toEqual([expect.objectContaining({ amount })])
        await settle()
        expect(events.for("payment.refunded", { id: payment_id })).toHaveLength(1)
      })

      it("refuses to refund more than was captured", async () => {
        const { payment_id } = await capturedOrder("standard")

        // Medusa tolerates 1p of rounding (currency epsilon); Stripe itself refuses
        // any refund above the unrefunded charge, so 2p over is the first 400 here.
        const over = await refund(payment_id, { amount: 13.49 })
        expect(over.status).toBe(400)
        expect(over.data.type).toBe("invalid_data")

        expect((await refund(payment_id, { amount: 10 })).status).toBe(200)
        const again = await refund(payment_id, { amount: 3.49 })
        expect(again.status).toBe(400)
        expect(refunds()).toHaveLength(1)
      })

      it("refuses to refund an authorised but uncaptured payment (cancel the order instead)", async () => {
        const { payment_id } = await placeAuthorisedOrder(getContainer(), {
          regionId,
          shippingOptionId: options["click-collect"],
          shippingAmount: 0,
        })
        resetPaymentRecorder()

        for (const body of [{}, { amount: 1 }]) {
          const res = await refund(payment_id, body)
          expect(res.status).toBe(400)
          expect(res.data.type).toBe("invalid_data")
          expect(res.data.message).toMatch(/captured/)
        }

        expect(refunds()).toHaveLength(0)
        const payment = await paymentOf(getContainer(), payment_id)
        expect(payment.refunds ?? []).toHaveLength(0)
        await settle()
        expect(events.for("payment.refunded")).toHaveLength(0)
      })

      it("refuses to refund a released (cancelled) authorisation", async () => {
        const { payment_id } = await placeAuthorisedOrder(getContainer(), {
          regionId,
          shippingOptionId: options["standard"],
          shippingAmount: 3.49,
        })
        await getContainer().resolve(Modules.PAYMENT).cancelPayment(payment_id)
        resetPaymentRecorder()

        const res = await refund(payment_id)

        expect(res.status).toBe(400)
        expect(refunds()).toHaveLength(0)
      })

      it("is admin only", async () => {
        const { payment_id } = await capturedOrder("standard")
        const res = await api.post(`/admin/payments/${payment_id}/refund`, {}).catch((e: any) => e.response)

        expect(res.status).toBe(401)
        expect(refunds()).toHaveLength(0)
      })
    })
  },
})
