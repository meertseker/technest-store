// Click & Collect state is read from order.metadata, and completeCartWorkflow copies cart.metadata onto the
// order. A shopper can write cart.metadata, so the state keys must never travel from a cart to an order.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"
import { seedTechNest } from "../../src/scripts/seed"
import { adminHeaders, storeHeaders } from "../helpers/auth"
import { waitForBackgroundWork } from "../helpers/background"
import { TEST_PROVIDER_ID, paymentOf, shippingOptionIdsByCode } from "../helpers/orders"
import { recordedPaymentCalls, resetPaymentRecorder } from "../helpers/recording-payment-provider"
import { orderPayment } from "../utils/store-order"

// Stripe stand-in (authorise only, capture on request), as in click-collect.spec.ts.
process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"

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
    let variantId: string
    let options: Record<string, string>

    beforeAll(async () => {
      const container = getContainer()
      const seeded = await seedTechNest(container)
      regionId = seeded.region.id
      // The shopper pays with the Stripe stand-in, so "captured or not" is observable.
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
      variantId = data[0].variants![0]!.id
      await waitForBackgroundWork(container)
    })

    beforeEach(() => resetPaymentRecorder())
    afterEach(() => waitForBackgroundWork(getContainer()))

    /**
     * A Click & Collect order placed like a shopper, publishable key only.
     * `metadata` is what the shopper sends on the cart (nothing = honest shopper).
     */
    async function placePickupOrder(metadata?: Record<string, unknown>) {
      const { data: created } = await api.post(
        "/store/carts",
        { region_id: regionId, email: "shopper@example.com" },
        store
      )
      const cartId = created.cart.id as string
      await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantId, quantity: 1 }, store)
      await api.post(
        `/store/carts/${cartId}`,
        { shipping_address: ADDRESS, billing_address: ADDRESS, ...(metadata ? { metadata } : {}) },
        store
      )
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: options["click-collect"] }, store)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, store)
      await api.post(
        `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
        { provider_id: TEST_PROVIDER_ID },
        store
      )
      const { data } = await api.post(`/store/carts/${cartId}/complete`, {}, store)
      if (data.type !== "order") {
        throw new Error(`setup: cart did not complete: ${JSON.stringify(data.error ?? data)}`)
      }
      return data.order.id as string
    }

    const column = async (status: string) =>
      ((await api.get(`/admin/click-collect/orders?status=${status}`, admin)).data.orders as any[]).map(
        (o) => ({ id: o.id, status: o.status, collection_code: o.collection_code })
      )
    /** Which board column(s) the order shows up in. */
    const columnsOf = async (orderId: string) => {
      const found: string[] = []
      for (const status of ["to_pick", "ready", "collected"]) {
        if ((await column(status)).some((o) => o.id === orderId)) found.push(status)
      }
      return found
    }

    it("control: an honest Click & Collect order is on the board as to_pick, authorised and not captured", async () => {
      const orderId = await placePickupOrder()

      expect(await columnsOf(orderId)).toEqual(["to_pick"])
      const payment = await orderPayment(getContainer(), orderId)
      expect((await paymentOf(getContainer(), payment.id)).captured_at).toBeFalsy()
    })

    it("(a) a shopper-sent collected_at does not take the order off the to_pick column", async () => {
      const orderId = await placePickupOrder({ collected_at: "2026-01-01T00:00:00Z" })

      expect(await columnsOf(orderId)).toEqual(["to_pick"])
    })

    it("(b) a shopper-sent ready_for_collection_at + collection_code does not make the order ready", async () => {
      const orderId = await placePickupOrder({
        ready_for_collection_at: "2026-01-01T00:00:00Z",
        collection_code: "HACKED",
      })

      expect(await columnsOf(orderId)).toEqual(["to_pick"])
      const [card] = (await column("to_pick")).filter((o) => o.id === orderId)
      expect(card?.collection_code ?? null).toBeNull()
    })

    it("(c) pressing Collected on a forged-collected order never reports success while the payment is uncaptured", async () => {
      const container = getContainer()
      const orderId = await placePickupOrder({ collected_at: "2026-01-01T00:00:00Z" })
      const payment = await orderPayment(container, orderId)

      const res = await api
        .post(`/admin/click-collect/orders/${orderId}/collected`, {}, admin)
        .catch((e: any) => e.response)

      const after = await paymentOf(container, payment.id)
      const outcome = {
        http_status: res.status,
        reported_status: res.data?.order?.status ?? null,
        payment_captured: Boolean(after.captured_at),
        capture_calls: recordedPaymentCalls().filter((c) => c.method === "capturePayment").length,
      }
      // Safe outcomes: refused (4xx, nothing captured) or a real collection (200 + captured).
      expect(outcome).not.toMatchObject({ http_status: 200, payment_captured: false })
    })

    it("(d) state keys sent when the cart is created are dropped; the shopper's other metadata is kept", async () => {
      const { data } = await api.post(
        "/store/carts",
        { region_id: regionId, metadata: { collected_at: "2026-01-01T00:00:00Z", gift_note: "For Sam" } },
        store
      )

      const cart = await getContainer().resolve(Modules.CART).retrieveCart(data.cart.id, { select: ["metadata"] })
      expect(cart.metadata).toEqual({ gift_note: "For Sam" })
    })

    it("(e) a cart that already carries a state key cannot be completed into an order", async () => {
      const container = getContainer()
      const { data: created } = await api.post(
        "/store/carts",
        { region_id: regionId, email: "shopper@example.com" },
        store
      )
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
      // Written past the Store API, as a path we don't know about would.
      await container
        .resolve(Modules.CART)
        .updateCarts(cartId, { metadata: { collected_at: "2026-01-01T00:00:00Z" } })

      const res = await api.post(`/store/carts/${cartId}/complete`, {}, store).catch((e: any) => e.response)

      // Refused, and the hold the shopper's card already carries is released (completion-releases-hold.spec.ts).
      expect({ status: res.status, type: res.data?.type, error: res.data?.error }).toEqual({
        status: 200,
        type: "cart",
        error: expect.objectContaining({ type: "invalid_data", payment_released: true }),
      })
      const { data: links } = await container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order_cart", fields: ["order_id"], filters: { cart_id: cartId } })
      expect(links).toEqual([])
    })
  },
})
