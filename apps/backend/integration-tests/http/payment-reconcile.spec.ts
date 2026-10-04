// The shopper's card is authorised in the browser; the order is created by the browser's follow-up call
// or by Stripe's webhook. When both are lost (tab closed and the webhook dropped), a hold with no order
// is left behind. The reconcile job finds those payment sessions and finishes or releases them.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createOrderPaymentCollectionWorkflow,
  createOrderWorkflow,
  updateRegionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { RECONCILE_AFTER_MS, reconcilePayments } from "../../src/lib/payment-reconcile"
import { seedTechNest } from "../../src/scripts/seed"
import { storeHeaders } from "../helpers/auth"
import { waitForBackgroundWork } from "../helpers/background"
import { TEST_PROVIDER_ID, shippingOptionIdsByCode } from "../helpers/orders"
import {
  failNextPaymentCall,
  recordedPaymentCalls,
  resetPaymentRecorder,
} from "../helpers/recording-payment-provider"

// Stripe stand-in: authorising a session always succeeds unless a test makes the next call fail.
process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

const MINUTE = 60 * 1000
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
    let variant: { id: string; inventory_item_id: string }

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
        entity: "product",
        fields: ["variants.id", "variants.inventory_items.inventory_item_id"],
        filters: { handle: "clear-shockproof-case" },
      })
      const v = (data[0] as any).variants[0]
      variant = { id: v.id, inventory_item_id: v.inventory_items[0].inventory_item_id }
      await waitForBackgroundWork(container)
    })

    beforeEach(() => resetPaymentRecorder())
    afterEach(() => waitForBackgroundWork(getContainer()))

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const ordersOf = async (cartId: string) =>
      (await query().graph({ entity: "order_cart", fields: ["order_id"], filters: { cart_id: cartId } })).data.length
    const calls = (method: string) => recordedPaymentCalls().filter((c) => c.method === method).length
    /** Runs the job as if it were `ms` after now. */
    const reconcile = (ms: number) => reconcilePayments(getContainer(), new Date(Date.now() + ms))
    const setStock = (quantity: number) =>
      getContainer()
        .resolve(Modules.INVENTORY)
        .updateInventoryLevels([
          { inventory_item_id: variant.inventory_item_id, location_id: locationId, stocked_quantity: quantity },
        ])

    /** A cart with a payment session, as it is after the shopper pressed Pay and the tab was closed. */
    async function paidButNeverCompleted() {
      const { data: created } = await api.post(
        "/store/carts",
        { region_id: regionId, email: "shopper@example.com" },
        store
      )
      const cartId = created.cart.id as string
      await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variant.id, quantity: 1 }, store)
      await api.post(`/store/carts/${cartId}`, { shipping_address: ADDRESS, billing_address: ADDRESS }, store)
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: options["standard"] }, store)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, store)
      await api.post(
        `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
        { provider_id: TEST_PROVIDER_ID },
        store
      )
      return cartId
    }

    it("leaves a payment session alone until it is old enough", async () => {
      const cartId = await paidButNeverCompleted()

      expect(await reconcile(RECONCILE_AFTER_MS - MINUTE)).toMatchObject({ orders_placed: 0, holds_released: 0 })
      expect(await ordersOf(cartId)).toBe(0)
      expect(calls("authorizePayment")).toBe(0)
    })

    it("places the order of a cart that was paid for but never completed", async () => {
      const cartId = await paidButNeverCompleted()

      expect(await reconcile(RECONCILE_AFTER_MS + MINUTE)).toMatchObject({ orders_placed: 1, holds_released: 0 })
      await waitForBackgroundWork(getContainer())

      expect(await ordersOf(cartId)).toBe(1)
      // A later run finds nothing left to do.
      expect(await reconcile(RECONCILE_AFTER_MS + 2 * MINUTE)).toMatchObject({ orders_placed: 0, holds_released: 0 })
      expect(await ordersOf(cartId)).toBe(1)
    })

    it("releases the hold when the order can no longer be placed (sold out meanwhile)", async () => {
      const cartId = await paidButNeverCompleted()
      await setStock(0)

      try {
        expect(await reconcile(RECONCILE_AFTER_MS + MINUTE)).toMatchObject({ orders_placed: 0, holds_released: 1 })
      } finally {
        await setStock(25)
      }

      expect(await ordersOf(cartId)).toBe(0)
      expect(calls("deletePayment") + calls("cancelPayment")).toBe(1)
    })

    it("does nothing for a session the shopper never paid (the provider doesn't confirm it)", async () => {
      const cartId = await paidButNeverCompleted()
      failNextPaymentCall("authorizePayment")

      expect(await reconcile(RECONCILE_AFTER_MS + MINUTE)).toMatchObject({ orders_placed: 0, holds_released: 0 })

      expect(await ordersOf(cartId)).toBe(0)
      expect(calls("deletePayment") + calls("cancelPayment")).toBe(0)
    })

    it("authorises the payment of an order that exists without one (the server died mid-completion)", async () => {
      const container = getContainer()
      const { result: order } = await createOrderWorkflow(container).run({
        input: {
          region_id: regionId,
          email: "shopper@example.com",
          currency_code: "gbp",
          items: [{ title: "USB-C cable", quantity: 1, unit_price: 4.99, is_tax_inclusive: true }],
          shipping_address: ADDRESS,
          shipping_methods: [
            { name: "Shipping", amount: 3.49, shipping_option_id: options["standard"], is_tax_inclusive: true },
          ],
        },
      })
      const { result: collections } = await createOrderPaymentCollectionWorkflow(container).run({
        input: { order_id: order.id, amount: 8.48 },
      })
      const payments = container.resolve(Modules.PAYMENT)
      const session = await payments.createPaymentSession(collections[0].id, {
        provider_id: TEST_PROVIDER_ID,
        amount: 8.48,
        currency_code: "gbp",
        data: {},
      })

      expect(await reconcile(RECONCILE_AFTER_MS + MINUTE)).toMatchObject({ payments_authorised: 1 })

      const [stored] = await payments.listPaymentSessions({ id: [session.id] }, { relations: ["payment"] })
      expect(stored.payment?.id).toBeTruthy()
      expect(stored.payment?.captured_at).toBeFalsy()
    })
  },
})
