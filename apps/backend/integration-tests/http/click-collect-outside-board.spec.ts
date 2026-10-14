// A Click & Collect order handed over with Medusa's own order-page buttons (fulfil, then "mark as
// delivered") instead of the Collected button on the board: nothing there takes the payment. The
// hourly lifecycle job must notice, take the payment once, mark the order collected and tell the shop.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"
import clickCollectLifecycleJob from "../../src/jobs/click-collect-lifecycle"
import { setAlertSinkForTests, type Alert } from "../../src/lib/alerting"
import { collectStatusOf } from "../../src/lib/click-collect"
import { seedTechNest } from "../../src/scripts/seed"
import { adminHeaders, storeHeaders } from "../helpers/auth"
import { waitForBackgroundWork } from "../helpers/background"
import { TEST_PROVIDER_ID, orderOf, paymentOf, shippingOptionIdsByCode } from "../helpers/orders"
import { recordedPaymentCalls, resetPaymentRecorder } from "../helpers/recording-payment-provider"
import { mailWithSubject, textOf } from "../utils/mailpit"
import { orderPayment } from "../utils/store-order"

const RUN = Date.now()
process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"
process.env.SHOP_NOTIFY_EMAIL = `e2-shop-outside-${RUN}@example.com`
const SHOP = process.env.SHOP_NOTIFY_EMAIL

jest.setTimeout(10 * 60 * 1000)
// Money paths: a test that only passes on a retry is a real fault, not noise (no retries here).
jest.retryTimes(0)

type Headers = { headers: Record<string, string> }

const ADDRESS = {
  first_name: "Sam",
  last_name: "Smith",
  address_1: "1 High St",
  city: "London",
  postal_code: "SE16 1AA",
  country_code: "gb",
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    let store: Headers
    let regionId: string
    let locationId: string
    let variantId: string
    let options: Record<string, string>
    let alerts: Alert[]

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
        fields: ["variants.id"],
        filters: { handle: "clear-shockproof-case" },
      })
      variantId = (data[0] as any).variants[0].id
      await waitForBackgroundWork(container)
    })

    beforeEach(() => {
      resetPaymentRecorder()
      alerts = []
      setAlertSinkForTests((a) => alerts.push(a))
    })
    afterEach(async () => {
      setAlertSinkForTests(undefined)
      await waitForBackgroundWork(getContainer())
    })

    async function placePickupOrder() {
      const { data: created } = await api.post("/store/carts", { region_id: regionId, email: "shopper@example.com" }, store)
      const cartId = created.cart.id as string
      await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantId, quantity: 1 }, store)
      await api.post(`/store/carts/${cartId}`, { shipping_address: ADDRESS, billing_address: ADDRESS }, store)
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: options["click-collect"] }, store)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, store)
      await api.post(
        `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
        { provider_id: TEST_PROVIDER_ID },
        store
      )
      const { data } = await api.post(`/store/carts/${cartId}/complete`, {}, store)
      if (data.type !== "order") throw new Error(`setup: cart did not complete: ${JSON.stringify(data.error ?? data)}`)
      await waitForBackgroundWork(getContainer())
      resetPaymentRecorder()
      return data.order as { id: string; display_id: number; items: { id: string; quantity: number }[] }
    }

    /** Medusa's own order page: "Fulfill items", then optionally "Mark as delivered". */
    async function fulfilNatively(order: { id: string; items: { id: string; quantity: number }[] }, deliver: boolean) {
      const { data } = await api.post(
        `/admin/orders/${order.id}/fulfillments?fields=id,*fulfillments`,
        { items: order.items.map((i) => ({ id: i.id, quantity: i.quantity })), location_id: locationId },
        admin
      )
      const fulfillmentId = data.order.fulfillments[0].id as string
      if (deliver) {
        await api.post(`/admin/orders/${order.id}/fulfillments/${fulfillmentId}/mark-as-delivered`, {}, admin)
      }
      await waitForBackgroundWork(getContainer())
      resetPaymentRecorder()
      return fulfillmentId
    }

    const captures = () => recordedPaymentCalls().filter((c) => c.method === "capturePayment")
    const metadataOf = async (orderId: string) =>
      ((await orderOf(getContainer(), orderId)).metadata ?? {}) as Record<string, any>
    const runJob = async () => {
      await clickCollectLifecycleJob(getContainer())
      await waitForBackgroundWork(getContainer())
    }

    it("a ready order delivered from the order page is captured once, marked collected, and the shop is told once", async () => {
      const order = await placePickupOrder()
      expect((await api.post(`/admin/click-collect/orders/${order.id}/ready`, {}, admin)).status).toBe(200)
      const fulfillmentId = await fulfilNatively(order, true)
      // Nothing on the order page took the money.
      const payment = await orderPayment(getContainer(), order.id)
      expect((await paymentOf(getContainer(), payment.id)).captured_at).toBeFalsy()

      await runJob()

      expect(captures()).toHaveLength(1)
      expect((await paymentOf(getContainer(), payment.id)).captured_at).toBeTruthy()
      const meta = await metadataOf(order.id)
      expect(collectStatusOf(meta)).toBe("collected")
      expect(meta.collected_outside_board).toEqual({ fulfillment_id: fulfillmentId, at: expect.any(String) })
      expect(alerts).toHaveLength(1)
      expect(alerts[0].tags).toMatchObject({ order_id: order.id })
      const subject = `Order #${order.display_id} was handed over outside the Click & Collect board`
      const [mail] = await mailWithSubject(SHOP, subject)
      expect(mail).toBeDefined()
      expect(await textOf(mail.ID)).toContain("use the Click & Collect board")

      // The next hour: nothing more.
      await runJob()
      expect(captures()).toHaveLength(1)
      expect(alerts).toHaveLength(1)
      expect(await mailWithSubject(SHOP, subject)).toHaveLength(1)
    })

    it("an order never marked ready and delivered from the order page is captured too", async () => {
      const order = await placePickupOrder()
      await fulfilNatively(order, true)

      await runJob()

      expect(captures()).toHaveLength(1)
      expect(collectStatusOf(await metadataOf(order.id))).toBe("collected")
    })

    it("an order only fulfilled (not handed over) is left alone", async () => {
      const order = await placePickupOrder()
      await fulfilNatively(order, false)

      await runJob()

      expect(captures()).toHaveLength(0)
      const meta = await metadataOf(order.id)
      expect(collectStatusOf(meta)).toBe("to_pick")
      expect(meta.collected_outside_board).toBeUndefined()
      expect(alerts).toHaveLength(0)
    })
  },
})
