// Stripe events that Medusa's own webhook handler drops: a chargeback, a refund made in the Stripe
// dashboard, and a card hold released at Stripe. Each must reach the order, Sentry and the shop's
// inbox once, however often Stripe delivers it.
import { createRequire } from "module"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { seedTechNest } from "../../src/scripts/seed"
import { setAlertSinkForTests, type Alert } from "../../src/lib/alerting"
import stripeEvents from "../../src/subscribers/stripe-events"
import { adminHeaders } from "../helpers/auth"
import { waitForBackgroundWork } from "../helpers/background"
import { orderOf, paymentOf, placeAuthorisedOrder, recordEvents, settle, shippingOptionIdsByCode } from "../helpers/orders"
import { recordedPaymentCalls, resetPaymentRecorder } from "../helpers/recording-payment-provider"
import { mailWithSubject, textOf } from "../utils/mailpit"

const SECRET = "whsec_integration_events"
const RUN = Date.now()
process.env.STRIPE_API_KEY = process.env.STRIPE_API_KEY || "sk_test_integration_boot_only"
process.env.STRIPE_WEBHOOK_SECRET = SECRET
process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"
process.env.SHOP_NOTIFY_EMAIL = `e2-shop-events-${RUN}@example.com`

const Stripe = createRequire(require.resolve("@medusajs/payment-stripe/package.json"))("stripe")
const sign = (payload: string, opts: Record<string, unknown> = {}) =>
  Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET, ...opts }) as string

jest.setTimeout(10 * 60 * 1000)
// Money paths: a test that only passes on a retry is a real fault, not noise (no retries here).
jest.retryTimes(0)

const URL = "/hooks/payment/stripe_stripe"
const SHOP = process.env.SHOP_NOTIFY_EMAIL!

const eventJson = (type: string, object: Record<string, unknown>) =>
  JSON.stringify({
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type,
    livemode: false,
    data: { object },
  })

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let regionId: string
    let options: Record<string, string>
    let admin: { headers: Record<string, string> }
    let events: ReturnType<typeof recordEvents>
    let alerts: Alert[]

    beforeAll(async () => {
      const container = getContainer()
      regionId = (await seedTechNest(container)).region.id
      options = await shippingOptionIdsByCode(container)
      admin = await adminHeaders(api, container)
      events = recordEvents(container, ["payment.refunded"])
      await waitForBackgroundWork(container)
    })

    beforeEach(() => {
      alerts = []
      setAlertSinkForTests((a) => alerts.push(a))
      resetPaymentRecorder()
      events.clear()
    })
    afterEach(async () => {
      setAlertSinkForTests(undefined)
      await waitForBackgroundWork(getContainer())
    })

    /** An authorised order; the recording provider gave its payment an intent id `pi_test_...`. */
    async function order(kind: "standard" | "click-collect" = "standard", capture = false) {
      const placed = await placeAuthorisedOrder(getContainer(), {
        regionId,
        shippingOptionId: options[kind],
        shippingAmount: kind === "standard" ? 3.49 : 0,
      })
      if (capture) {
        await capturePaymentWorkflow(getContainer()).run({ input: { payment_id: placed.payment_id } })
      }
      const payment = await getContainer()
        .resolve(Modules.PAYMENT)
        .retrievePayment(placed.payment_id, { select: ["data"] })
      resetPaymentRecorder()
      return { ...placed, intent_id: (payment.data as { id: string }).id }
    }

    /** What the worker sees for one queued delivery of a signed event. */
    const deliver = (body: string, signature = sign(body)) =>
      stripeEvents({
        event: {
          name: "payment.webhook_received",
          data: {
            provider: "stripe_stripe",
            payload: {
              data: JSON.parse(body),
              rawData: Buffer.from(body),
              headers: { "stripe-signature": signature },
            },
          },
        },
        container: getContainer(),
      } as any)

    const metadataOf = async (orderId: string) =>
      ((await orderOf(getContainer(), orderId)).metadata ?? {}) as Record<string, any>

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const paymentStatus = async (orderId: string) =>
      (await api.get(`/admin/orders/${orderId}?fields=id,payment_status`, admin)).data.order.payment_status

    const dispute = (intentId: string, over: Record<string, unknown> = {}) => ({
      id: "dp_test_1",
      object: "dispute",
      amount: 1347,
      currency: "gbp",
      reason: "fraudulent",
      status: "needs_response",
      payment_intent: intentId,
      charge: "ch_test_1",
      evidence_details: { due_by: 1761264000 },
      ...over,
    })

    describe("charge.dispute.created", () => {
      it("arrives through the signed route, is written to the order, alerted and emailed to the shop once", async () => {
        const { order: o, intent_id, payment_id } = await order("standard", true)
        const body = eventJson("charge.dispute.created", dispute(intent_id))
        const subject = `Chargeback on order #${o.display_id}: £13.47, respond by Friday 24 October`

        const res = await api.post(URL, body, {
          headers: { "content-type": "application/json", "stripe-signature": sign(body) },
        })
        expect(res.status).toBe(200)

        // Medusa queues the event with a 5 s delay before the worker side runs.
        let meta: Record<string, any> = {}
        for (let i = 0; i < 80 && !meta.dispute; i++) {
          await settle(250)
          meta = await metadataOf(o.id)
        }
        expect(meta.dispute).toEqual({
          id: "dp_test_1",
          status: "needs_response",
          reason: "fraudulent",
          amount_pence: 1347,
          currency: "gbp",
          due_by: "2025-10-24T00:00:00.000Z",
          livemode: false,
          opened_at: expect.any(String),
        })
        expect(alerts).toHaveLength(1)
        expect(alerts[0].message).toContain(o.id)
        expect(alerts[0].tags).toMatchObject({ order_id: o.id, dispute_id: "dp_test_1" })
        const [mail] = await mailWithSubject(SHOP, subject)
        expect(mail).toBeDefined()
        const text = await textOf(mail.ID)
        expect(text).toContain("fraudulent")
        expect(text).toContain("https://dashboard.stripe.com/test/disputes/dp_test_1")
        expect(text).toContain(`/orders/${o.id}`)

        // Stripe delivers it again: nothing doubles.
        await deliver(body)
        await waitForBackgroundWork(getContainer())
        expect(alerts).toHaveLength(1)
        expect((await metadataOf(o.id)).dispute).toEqual(meta.dispute)
        expect(await mailWithSubject(SHOP, subject)).toHaveLength(1)
        expect((await paymentOf(getContainer(), payment_id)).captured_at).toBeTruthy()
      })

      it("a later dispute status is recorded without a second alert, and a missed opening is caught up", async () => {
        const { order: o, intent_id } = await order("standard", true)
        await deliver(eventJson("charge.dispute.created", dispute(intent_id, { id: "dp_test_2" })))
        alerts = []

        await deliver(eventJson("charge.dispute.closed", dispute(intent_id, { id: "dp_test_2", status: "won" })))
        expect((await metadataOf(o.id)).dispute).toMatchObject({
          id: "dp_test_2",
          status: "won",
          closed_at: expect.any(String),
        })
        expect(alerts).toHaveLength(0)

        const other = await order("standard", true)
        await deliver(
          eventJson("charge.dispute.updated", dispute(other.intent_id, { id: "dp_test_3", status: "under_review" }))
        )
        expect((await metadataOf(other.order.id)).dispute).toMatchObject({ id: "dp_test_3", status: "under_review" })
        expect(alerts).toHaveLength(1)
      })

      it("ignores a dispute for a payment Medusa does not know, and an event with a bad signature", async () => {
        const { order: o, intent_id } = await order("standard", true)
        await deliver(eventJson("charge.dispute.created", dispute("pi_unknown")))
        await deliver(eventJson("charge.dispute.created", dispute(intent_id)), "t=1,v1=00")
        expect(alerts).toHaveLength(0)
        expect((await metadataOf(o.id)).dispute).toBeUndefined()
      })
    })

    describe("charge.refunded", () => {
      const charge = (intentId: string, amountRefunded: number, refunds: { id: string; amount: number }[] = []) => ({
        id: "ch_test_r",
        object: "charge",
        amount: 1347,
        amount_refunded: amountRefunded,
        currency: "gbp",
        payment_intent: intentId,
        refunded: amountRefunded >= 1347,
        metadata: { session_id: "payses_x" },
        refunds: { object: "list", data: refunds.map((r) => ({ object: "refund", currency: "gbp", ...r })) },
      })

      it("a refund made in the Stripe dashboard is recorded on the payment and the order, emitted once, and the shop is told", async () => {
        const { order: o, intent_id, payment_id } = await order("standard", true)
        const body = eventJson("charge.refunded", charge(intent_id, 499, [{ id: "re_dash_1", amount: 499 }]))

        await deliver(body)
        await deliver(body)
        await waitForBackgroundWork(getContainer())

        const payment = await paymentOf(getContainer(), payment_id)
        expect(payment.refunds.map((r: any) => Number(r.amount))).toEqual([4.99])
        // Nothing was sent to the provider: the money already moved.
        expect(recordedPaymentCalls().filter((c) => c.method === "refundPayment")).toHaveLength(0)
        const { data: refunds } = await query().graph({
          entity: "refund",
          fields: ["id", "note", "metadata"],
          filters: { payment_id },
        })
        expect(refunds[0]).toMatchObject({
          note: expect.stringContaining("Stripe dashboard"),
          metadata: { stripe_refund_id: "re_dash_1" },
        })
        const { data: txs } = await query().graph({
          entity: "order_transaction",
          fields: ["amount", "reference", "reference_id"],
          filters: { order_id: o.id },
        })
        expect(txs.filter((t) => t.reference === "refund")).toEqual([
          expect.objectContaining({ amount: -4.99, reference_id: refunds[0].id }),
        ])
        const { data: orders } = await query().graph({
          entity: "order",
          fields: ["id", "payment_collections.refunded_amount"],
          filters: { id: o.id },
        })
        expect(Number(orders[0].payment_collections![0]!.refunded_amount)).toBe(4.99)
        // payment_status is computed by the admin API, not stored: read it the way the admin does.
        expect(await paymentStatus(o.id)).toBe("partially_refunded")
        expect((await metadataOf(o.id)).external_refunds).toEqual([
          { id: "re_dash_1", amount_pence: 499, at: expect.any(String) },
        ])
        await settle()
        expect(events.for("payment.refunded", { id: payment_id })).toHaveLength(1)
        expect(alerts).toHaveLength(1)
        const [mail] = await mailWithSubject(SHOP, `Refund of £4.99 made in Stripe, not the admin: order #${o.display_id}`)
        expect(mail).toBeDefined()
        expect(await textOf(mail.ID)).toContain("the customer has been emailed the usual refund notice")
      })

      it("the same dashboard refund delivered twice at the same moment is written once", async () => {
        const { order: o, intent_id, payment_id } = await order("standard", true)
        const body = eventJson("charge.refunded", charge(intent_id, 499, [{ id: "re_dash_race", amount: 499 }]))

        await Promise.all([deliver(body), deliver(body), deliver(body)])
        await waitForBackgroundWork(getContainer())

        const payment = await paymentOf(getContainer(), payment_id)
        expect(payment.refunds.map((r: any) => Number(r.amount))).toEqual([4.99])
        const { data: txs } = await query().graph({
          entity: "order_transaction",
          fields: ["amount", "reference"],
          filters: { order_id: o.id },
        })
        expect(txs.filter((t) => t.reference === "refund")).toHaveLength(1)
        expect((await metadataOf(o.id)).external_refunds).toHaveLength(1)
        await settle()
        expect(events.for("payment.refunded", { id: payment_id })).toHaveLength(1)
      })

      it("a refund made in the admin produces no second record when its event arrives", async () => {
        const { order: o, intent_id, payment_id } = await order("standard", true)
        expect((await api.post(`/admin/payments/${payment_id}/refund`, { amount: 4.99 }, admin)).status).toBe(200)
        await settle()
        events.clear()

        await deliver(eventJson("charge.refunded", charge(intent_id, 499, [{ id: "re_admin_1", amount: 499 }])))
        await waitForBackgroundWork(getContainer())

        expect((await paymentOf(getContainer(), payment_id)).refunds).toHaveLength(1)
        expect((await metadataOf(o.id)).external_refunds).toBeUndefined()
        expect(alerts).toHaveLength(0)
        expect(events.for("payment.refunded")).toHaveLength(0)
      })

      it("a dashboard refund on top of an admin refund records only the difference", async () => {
        const { order: o, intent_id, payment_id } = await order("standard", true)
        expect((await api.post(`/admin/payments/${payment_id}/refund`, { amount: 4.99 }, admin)).status).toBe(200)

        await deliver(
          eventJson(
            "charge.refunded",
            charge(intent_id, 1347, [
              { id: "re_admin_2", amount: 499 },
              { id: "re_dash_2", amount: 848 },
            ])
          )
        )
        await waitForBackgroundWork(getContainer())

        const payment = await paymentOf(getContainer(), payment_id)
        expect(payment.refunds.map((r: any) => Number(r.amount)).sort()).toEqual([4.99, 8.48])
        expect((await metadataOf(o.id)).external_refunds).toEqual([
          { id: "re_dash_2", amount_pence: 848, at: expect.any(String) },
        ])
        expect(await paymentStatus(o.id)).toBe("refunded")
      })

      it("a refund of more than Medusa captured is noted and reported but not written as a refund", async () => {
        // The capture itself happened outside Medusa too (e.g. in the dashboard): nothing to refund against.
        const { order: o, intent_id, payment_id } = await order("standard", false)

        await deliver(eventJson("charge.refunded", charge(intent_id, 1347, [{ id: "re_dash_3", amount: 1347 }])))
        await waitForBackgroundWork(getContainer())

        expect((await paymentOf(getContainer(), payment_id)).refunds ?? []).toHaveLength(0)
        expect((await metadataOf(o.id)).external_refunds).toEqual([
          { id: "re_dash_3", amount_pence: 1347, at: expect.any(String), unrecorded: true },
        ])
        expect(alerts).toHaveLength(1)
        expect(events.for("payment.refunded")).toHaveLength(0)
        expect(await mailWithSubject(SHOP, `Refund of £13.47 made in Stripe, not the admin: order #${o.display_id}`)).toHaveLength(1)
      })
    })

    describe("payment_intent.canceled", () => {
      const canceled = (intentId: string, reason: string | null = "requested_by_customer") => ({
        id: intentId,
        object: "payment_intent",
        amount: 998,
        currency: "gbp",
        status: "canceled",
        cancellation_reason: reason,
        metadata: { session_id: "payses_x" },
      })

      it("a hold released at Stripe on a live order is noted, alerted and emailed to the shop once", async () => {
        const { order: o, intent_id, payment_id } = await order("click-collect")
        const body = eventJson("payment_intent.canceled", canceled(intent_id))
        const subject = `Card hold released at Stripe: order #${o.display_id} can't be charged`

        await deliver(body)
        await deliver(body)
        await waitForBackgroundWork(getContainer())

        expect((await metadataOf(o.id)).payment_hold_released).toEqual({
          payment_intent: intent_id,
          reason: "requested_by_customer",
          amount_pence: 998,
          at: expect.any(String),
        })
        expect(alerts).toHaveLength(1)
        expect(alerts[0].tags).toMatchObject({ order_id: o.id })
        const [mail] = await mailWithSubject(SHOP, subject)
        expect(mail).toBeDefined()
        const text = await textOf(mail.ID)
        expect(text).toContain("cannot be captured")
        expect(text).toContain("requested_by_customer")
        expect(await mailWithSubject(SHOP, subject)).toHaveLength(1)
        // Nothing was captured or cancelled on our side.
        expect(recordedPaymentCalls()).toEqual([])
        expect((await paymentOf(getContainer(), payment_id)).canceled_at).toBeFalsy()
      })

      it("a cancellation Medusa made itself, or on a cancelled order, is left alone", async () => {
        const ours = await order("click-collect")
        await getContainer().resolve(Modules.PAYMENT).cancelPayment(ours.payment_id)
        await deliver(eventJson("payment_intent.canceled", canceled(ours.intent_id, null)))

        const gone = await order("click-collect")
        await getContainer().resolve(Modules.ORDER).cancel(gone.order.id)
        await deliver(eventJson("payment_intent.canceled", canceled(gone.intent_id, "abandoned")))
        await waitForBackgroundWork(getContainer())

        expect(alerts).toHaveLength(0)
        expect((await metadataOf(ours.order.id)).payment_hold_released).toBeUndefined()
        expect((await metadataOf(gone.order.id)).payment_hold_released).toBeUndefined()
      })
    })
  },
})
