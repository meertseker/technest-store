// A Click & Collect order placed by a shopper on a product with tracked stock: what happens to the
// stock and its reservation when the order is collected, and when it is cancelled at its deadline.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"
import clickCollectLifecycleJob from "../../src/jobs/click-collect-lifecycle"
import { seedTechNest } from "../../src/scripts/seed"
import { adminHeaders, storeHeaders } from "../helpers/auth"
import { waitForBackgroundWork } from "../helpers/background"
import { TEST_PROVIDER_ID, orderOf, paymentOf, shippingOptionIdsByCode } from "../helpers/orders"
import { recordedPaymentCalls, resetPaymentRecorder } from "../helpers/recording-payment-provider"
import { orderPayment } from "../utils/store-order"

process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"

jest.setTimeout(10 * 60 * 1000)
// Money paths: a test that only passes on a retry is a real fault, not noise (no retries here).
jest.retryTimes(0)

type Headers = { headers: Record<string, string> }

const DAY = 24 * 60 * 60 * 1000
const QUANTITY = 2
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
    let inventoryItemId: string
    let options: Record<string, string>

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
        fields: ["variants.id", "variants.manage_inventory", "variants.inventory_items.inventory_item_id"],
        filters: { handle: "clear-shockproof-case" },
      })
      const variant = (data[0] as any).variants[0]
      expect(variant.manage_inventory).toBe(true)
      variantId = variant.id
      inventoryItemId = variant.inventory_items[0].inventory_item_id
      await waitForBackgroundWork(container)
    })

    beforeEach(() => resetPaymentRecorder())
    afterEach(() => waitForBackgroundWork(getContainer()))

    /** Units on the shelf and units set aside for orders, at the shop. */
    const stock = async () => {
      const [level] = await getContainer()
        .resolve(Modules.INVENTORY)
        .listInventoryLevels({ inventory_item_id: inventoryItemId, location_id: locationId })
      return { on_shelf: Number(level.stocked_quantity), set_aside: Number(level.reserved_quantity) }
    }
    const reservationsOf = async (orderId: string) => {
      const order = await getContainer()
        .resolve(Modules.ORDER)
        .retrieveOrder(orderId, { relations: ["items"] })
      const lineIds = (order.items ?? []).map((i) => i.id)
      return getContainer().resolve(Modules.INVENTORY).listReservationItems({ line_item_id: lineIds })
    }

    async function placePickupOrder() {
      const { data: created } = await api.post(
        "/store/carts",
        { region_id: regionId, email: "shopper@example.com" },
        store
      )
      const cartId = created.cart.id as string
      await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantId, quantity: QUANTITY }, store)
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
      return data.order.id as string
    }
    const press = (orderId: string, action: "ready" | "collected") =>
      api.post(`/admin/click-collect/orders/${orderId}/${action}`, {}, admin).catch((e: any) => e.response)

    it("placing the order sets the units aside without taking them off the shelf or the money", async () => {
      const before = await stock()

      const orderId = await placePickupOrder()

      expect(await stock()).toEqual({ on_shelf: before.on_shelf, set_aside: before.set_aside + QUANTITY })
      expect(await reservationsOf(orderId)).toHaveLength(1)
      const payment = await orderPayment(getContainer(), orderId)
      expect((await paymentOf(getContainer(), payment.id)).captured_at).toBeFalsy()
    })

    it("Collected takes the money once and the units off the shelf, and leaves nothing set aside", async () => {
      const before = await stock()
      const orderId = await placePickupOrder()
      expect((await press(orderId, "ready")).status).toBe(200)

      const collected = await press(orderId, "collected")
      await waitForBackgroundWork(getContainer())

      expect(collected.status).toBe(200)
      const payment = await orderPayment(getContainer(), orderId)
      expect((await paymentOf(getContainer(), payment.id)).captured_at).toBeTruthy()
      expect(recordedPaymentCalls().filter((c) => c.method === "capturePayment")).toHaveLength(1)
      expect(await stock()).toEqual({ on_shelf: before.on_shelf - QUANTITY, set_aside: before.set_aside })
      expect(await reservationsOf(orderId)).toHaveLength(0)

      // Pressing again changes nothing.
      expect((await press(orderId, "collected")).status).toBe(200)
      expect(await stock()).toEqual({ on_shelf: before.on_shelf - QUANTITY, set_aside: before.set_aside })
      expect(recordedPaymentCalls().filter((c) => c.method === "capturePayment")).toHaveLength(1)
    })

    it("an order cancelled at its deadline puts the units back and releases the hold", async () => {
      const container = getContainer()
      const before = await stock()
      const orderId = await placePickupOrder()
      expect((await press(orderId, "ready")).status).toBe(200)
      await container
        .resolve(ContainerRegistrationKeys.PG_CONNECTION)
        .raw(`update "order" set created_at = ? where id = ?`, [new Date(Date.now() - 6.9 * DAY), orderId])
      resetPaymentRecorder()

      await clickCollectLifecycleJob(container)
      await waitForBackgroundWork(container)

      expect((await orderOf(container, orderId)).status).toBe("canceled")
      expect(await stock()).toEqual(before)
      expect(await reservationsOf(orderId)).toHaveLength(0)
      expect(recordedPaymentCalls().map((c) => c.method)).toEqual(["cancelPayment"])
    })
  },
})
