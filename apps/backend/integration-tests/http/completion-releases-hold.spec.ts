// The shopper's card is authorised in the browser before the cart is completed. When completion is then
// refused (the last unit was sold meanwhile, a basket rule), the hold must be released, not left on the card.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"
import { seedTechNest } from "../../src/scripts/seed"
import { storeHeaders } from "../helpers/auth"
import { waitForBackgroundWork } from "../helpers/background"
import { TEST_PROVIDER_ID, shippingOptionIdsByCode } from "../helpers/orders"
import { recordedPaymentCalls, resetPaymentRecorder } from "../helpers/recording-payment-provider"

// Stripe stand-in: deleting or cancelling a payment is what cancels the PaymentIntent at Stripe.
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
    let store: Headers
    let regionId: string
    let locationId: string
    let options: Record<string, string>
    const variants: Record<string, { id: string; inventory_item_id: string }> = {}

    beforeAll(async () => {
      const container = getContainer()
      const seeded = await seedTechNest(container)
      regionId = seeded.region.id
      locationId = seeded.stockLocation.id
      await updateRegionsWorkflow(container).run({
        input: { selector: { id: regionId }, update: { payment_providers: [TEST_PROVIDER_ID] } },
      })
      options = await shippingOptionIdsByCode(container)
      store = await storeHeaders(container)
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product_variant",
        fields: ["id", "product.handle", "inventory_items.inventory_item_id"],
      })
      for (const v of data as any[]) {
        variants[v.product.handle] ??= { id: v.id, inventory_item_id: v.inventory_items?.[0]?.inventory_item_id }
      }
      await waitForBackgroundWork(container)
    })

    beforeEach(() => resetPaymentRecorder())
    afterEach(() => waitForBackgroundWork(getContainer()))

    const released = () =>
      recordedPaymentCalls().filter((c) => c.method === "deletePayment" || c.method === "cancelPayment").length
    const ordersOf = async (cartId: string) =>
      (
        await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "order_cart", fields: ["order_id"], filters: { cart_id: cartId } })
      ).data.length

    /** A delivery cart with a payment session, as it is when the shopper presses Pay. */
    async function cartReadyToPay(handle: string) {
      const { data: created } = await api.post(
        "/store/carts",
        { region_id: regionId, email: "shopper@example.com" },
        store
      )
      const cartId = created.cart.id as string
      await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variants[handle].id, quantity: 1 }, store)
      await api.post(`/store/carts/${cartId}`, { shipping_address: ADDRESS, billing_address: ADDRESS }, store)
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: options["standard"] }, store)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, store)
      const collectionId = pc.payment_collection.id as string
      const session = await api
        .post(`/store/payment-collections/${collectionId}/payment-sessions`, { provider_id: TEST_PROVIDER_ID }, store)
        .catch((e: any) => e.response)
      return { cartId, collectionId, session }
    }

    const setStock = (handle: string, quantity: number) =>
      getContainer()
        .resolve(Modules.INVENTORY)
        .updateInventoryLevels([
          { inventory_item_id: variants[handle].inventory_item_id, location_id: locationId, stocked_quantity: quantity },
        ])

    const reserved = async (handle: string) => {
      const [level] = await getContainer()
        .resolve(Modules.INVENTORY)
        .listInventoryLevels({ inventory_item_id: variants[handle].inventory_item_id, location_id: locationId })
      return Number(level.reserved_quantity)
    }

    it("control: a cart that can be completed becomes an order and nothing is released", async () => {
      const { cartId } = await cartReadyToPay("clear-shockproof-case")

      const { data } = await api.post(`/store/carts/${cartId}/complete`, {}, store)

      expect(data.type).toBe("order")
      expect(released()).toBe(0)
    })

    it("releases the hold and says so when the last unit was sold before completion", async () => {
      const { cartId } = await cartReadyToPay("clear-shockproof-case")
      await setStock("clear-shockproof-case", 0)

      const res = await api.post(`/store/carts/${cartId}/complete`, {}, store).catch((e: any) => e.response)

      expect(res.status).toBe(200)
      expect(res.data).toMatchObject({ type: "cart", error: { payment_released: true } })
      expect(released()).toBe(1)
      expect(await ordersOf(cartId)).toBe(0)

      // The shopper can pay again once the basket is fixed: a new session, a new hold.
      await setStock("clear-shockproof-case", 5)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, store)
      await api.post(
        `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
        { provider_id: TEST_PROVIDER_ID },
        store
      )
      const retry = await api.post(`/store/carts/${cartId}/complete`, {}, store)
      expect(retry.data.type).toBe("order")
    })

    it("refuses two lines of the same item that together need more than the stock, and releases the hold", async () => {
      const handle = "clear-shockproof-case"
      const { data: created } = await api.post("/store/carts", { region_id: regionId, email: "shopper@example.com" }, store)
      const cartId = created.cart.id as string
      // Different metadata keeps them as two lines; Medusa checks each against the full stock.
      await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variants[handle].id, quantity: 3, metadata: { note: "a" } }, store)
      const { data: two } = await api.post(
        `/store/carts/${cartId}/line-items`,
        { variant_id: variants[handle].id, quantity: 3, metadata: { note: "b" } },
        store
      )
      expect(two.cart.items).toHaveLength(2)
      await api.post(`/store/carts/${cartId}`, { shipping_address: ADDRESS, billing_address: ADDRESS }, store)
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: options["standard"] }, store)
      await setStock(handle, 5)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, store)
      await api.post(`/store/payment-collections/${pc.payment_collection.id}/payment-sessions`, { provider_id: TEST_PROVIDER_ID }, store)
      const reservedBefore = await reserved(handle)

      const res = await api.post(`/store/carts/${cartId}/complete`, {}, store).catch((e: any) => e.response)

      expect(res.status).toBe(200)
      expect(res.data).toMatchObject({ type: "cart", error: { type: "not_allowed", payment_released: true } })
      expect(released()).toBe(1)
      expect(await ordersOf(cartId)).toBe(0)
      expect(await reserved(handle)).toBe(reservedBefore)

      // Within the stock, the same two lines become an order.
      await setStock(handle, 6)
      const { data: pc2 } = await api.post("/store/payment-collections", { cart_id: cartId }, store)
      await api.post(`/store/payment-collections/${pc2.payment_collection.id}/payment-sessions`, { provider_id: TEST_PROVIDER_ID }, store)
      const retry = await api.post(`/store/carts/${cartId}/complete`, {}, store)
      expect(retry.data.type).toBe("order")
      expect(await reserved(handle)).toBe(reservedBefore + 6)
    })

    it("refuses a payment session for a basket that breaks the add-on rule, before any hold is placed", async () => {
      const { data: created } = await api.post(
        "/store/carts",
        { region_id: regionId, email: "shopper@example.com" },
        store
      )
      const cartId = created.cart.id as string
      const { data: withCase } = await api.post(
        `/store/carts/${cartId}/line-items`,
        { variant_id: variants["clear-shockproof-case"].id, quantity: 1 },
        store
      )
      await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variants["phone-ring-holder"].id, quantity: 1 }, store)
      await api.post(`/store/carts/${cartId}`, { shipping_address: ADDRESS, billing_address: ADDRESS }, store)
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: options["standard"] }, store)
      // The full-price item goes: an add-on only basket with delivery already chosen.
      await api.delete(`/store/carts/${cartId}/line-items/${withCase.cart.items[0].id}`, store)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, store)

      const res = await api
        .post(`/store/payment-collections/${pc.payment_collection.id}/payment-sessions`, { provider_id: TEST_PROVIDER_ID }, store)
        .catch((e: any) => e.response)

      expect({ status: res.status, type: res.data?.type }).toEqual({ status: 400, type: "not_allowed" })
      expect(recordedPaymentCalls().filter((c) => c.method === "initiatePayment")).toHaveLength(0)
    })
  },
})
