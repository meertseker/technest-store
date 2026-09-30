import { createRequire } from "module"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules, PaymentActions, PaymentWebhookEvents } from "@medusajs/framework/utils"
import { capturePaymentWorkflow, processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { seedTechNest } from "../../src/scripts/seed"
import { paymentOf, placeAuthorisedOrder, shippingOptionIdsByCode } from "../helpers/orders"
import { recordedPaymentCalls, resetPaymentRecorder } from "../helpers/recording-payment-provider"

const SECRET = "whsec_integration_webhook"
process.env.STRIPE_API_KEY = process.env.STRIPE_API_KEY || "sk_test_integration_boot_only"
process.env.STRIPE_WEBHOOK_SECRET = SECRET
process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"

// Stripe's own library signs the test events (offline).
const Stripe = createRequire(require.resolve("@medusajs/payment-stripe/package.json"))("stripe")
const sign = (payload: string, opts: Record<string, unknown> = {}) =>
  Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET, ...opts }) as string

jest.setTimeout(10 * 60 * 1000)

const URL = "/hooks/payment/stripe_stripe"

/** A Stripe event as raw JSON, deliberately not in JSON.stringify's canonical form. */
const eventJson = (type: string, intent: Record<string, unknown>) =>
  `{ "id": "evt_${Math.random().toString(36).slice(2)}", "object": "event", "type": "${type}",\n  "data": { "object": ${JSON.stringify(intent, null, 2)} } }`

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let regionId: string
    let options: Record<string, string>

    // Top level: the runner snapshots the DB after these hooks and restores it before each test.
    beforeAll(async () => {
      const seeded = await seedTechNest(getContainer())
      regionId = seeded.region.id
      options = await shippingOptionIdsByCode(getContainer())
    })

    const post = (body: string, headers: Record<string, string>) =>
      api
        .post(URL, body, { headers: { "content-type": "application/json", ...headers } })
        .catch((e: any) => e.response)

    const intent = { id: "pi_x", object: "payment_intent", amount: 1347, currency: "gbp", metadata: { session_id: "payses_x" } }

    describe("POST /hooks/payment/stripe_stripe signature check", () => {
      let queued: unknown[]

      beforeEach(() => {
        queued = []
        const bus = getContainer().resolve(Modules.EVENT_BUS)
        const original = bus.emit.bind(bus)
        // Record what the route queues and keep it from the worker-side handler
        // (tested below); every other event passes through.
        jest.spyOn(bus, "emit").mockImplementation((async (messages: any, options: any) => {
          const list = (Array.isArray(messages) ? messages : [messages]) as any[]
          const rest = list.filter((m) => m?.name !== PaymentWebhookEvents.WebhookReceived)
          queued.push(...list.filter((m) => m?.name === PaymentWebhookEvents.WebhookReceived).map((m) => m.data))
          if (rest.length) await original(rest as never, options)
        }) as never)
      })

      afterEach(() => jest.restoreAllMocks())

      it("accepts an event signed over the exact raw body and queues it once", async () => {
        const body = eventJson("payment_intent.amount_capturable_updated", intent)

        const res = await post(body, { "stripe-signature": sign(body) })

        expect(res.status).toBe(200)
        expect(queued).toHaveLength(1)
        expect((queued[0] as any).provider).toBe("stripe_stripe")
      })

      it.each([
        ["no signature header", (b: string) => ({ body: b, headers: {} })],
        ["a signature for another secret", (b: string) => ({ body: b, headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: b, secret: "whsec_attacker" }) } })],
        ["a tampered body", (b: string) => ({ body: b.replace("1347", "1"), headers: { "stripe-signature": sign(b) } })],
        ["a replayed (stale) signature", (b: string) => ({ body: b, headers: { "stripe-signature": sign(b, { timestamp: Math.floor(Date.now() / 1000) - 3600 }) } })],
        ["a garbage signature", (b: string) => ({ body: b, headers: { "stripe-signature": "t=1,v1=deadbeef" } })],
      ])("rejects %s with 400 and queues nothing", async (_name, make) => {
        const { body, headers } = make(eventJson("payment_intent.succeeded", intent))

        const res = await post(body, headers as Record<string, string>)

        expect(res.status).toBe(400)
        expect(res.data).toEqual({ type: "invalid_data", message: "Invalid webhook signature" })
        expect(queued).toHaveLength(0)
      })
    })

    describe("processing is idempotent (duplicate Stripe deliveries)", () => {
      /** What the worker does with a queued event: Stripe's verifier + processPaymentWorkflow. */
      const deliver = async (type: string, obj: Record<string, unknown>) => {
        const body = eventJson(type, obj)
        const paymentModule = getContainer().resolve(Modules.PAYMENT)
        const action = await paymentModule.getWebhookActionAndData({
          provider: "stripe_stripe",
          payload: { data: JSON.parse(body), rawData: Buffer.from(body), headers: { "stripe-signature": sign(body) } },
        })
        await processPaymentWorkflow(getContainer()).run({ input: action })
        return action
      }

      it("a captured delivery order stays captured once when payment_intent.succeeded arrives twice", async () => {
        const { payment_id } = await placeAuthorisedOrder(getContainer(), {
          regionId,
          shippingOptionId: options["standard"],
          shippingAmount: 3.49,
        })
        await capturePaymentWorkflow(getContainer()).run({ input: { payment_id } })
        const payment = await getContainer().resolve(Modules.PAYMENT).retrievePayment(payment_id, { select: ["payment_session_id"] })
        resetPaymentRecorder()

        const succeeded = {
          id: "pi_dup", object: "payment_intent", amount: 1347, amount_received: 1347, currency: "gbp",
          metadata: { session_id: payment.payment_session_id },
        }
        const first = await deliver("payment_intent.succeeded", succeeded)
        await deliver("payment_intent.succeeded", succeeded)

        expect(first).toEqual({ action: PaymentActions.SUCCESSFUL, data: { session_id: payment.payment_session_id, amount: 13.47 } })
        expect(recordedPaymentCalls().filter((c) => c.method === "capturePayment")).toHaveLength(0)
        expect((await paymentOf(getContainer(), payment_id)).captures).toHaveLength(1)
      })

      it("an authorised Click & Collect order is not captured or re-authorised by duplicate amount_capturable_updated", async () => {
        const { payment_id } = await placeAuthorisedOrder(getContainer(), {
          regionId,
          shippingOptionId: options["click-collect"],
          shippingAmount: 0,
        })
        const payment = await getContainer().resolve(Modules.PAYMENT).retrievePayment(payment_id, { select: ["payment_session_id"] })
        resetPaymentRecorder()

        const capturable = {
          id: "pi_cc", object: "payment_intent", amount: 998, amount_capturable: 998, currency: "gbp",
          metadata: { session_id: payment.payment_session_id },
        }
        await deliver("payment_intent.amount_capturable_updated", capturable)
        await deliver("payment_intent.amount_capturable_updated", capturable)

        const after = await paymentOf(getContainer(), payment_id)
        expect(after.captured_at).toBeFalsy()
        expect(after.captures ?? []).toHaveLength(0)
        expect(recordedPaymentCalls().filter((c) => ["capturePayment", "authorizePayment"].includes(c.method))).toHaveLength(0)
      })

      it("Stripe's verifier in the worker also refuses a bad signature", async () => {
        const body = eventJson("payment_intent.succeeded", intent)
        await expect(
          getContainer().resolve(Modules.PAYMENT).getWebhookActionAndData({
            provider: "stripe_stripe",
            payload: { data: JSON.parse(body), rawData: Buffer.from(body), headers: { "stripe-signature": "t=1,v1=00" } },
          })
        ).rejects.toThrow()
      })
    })
  },
})
