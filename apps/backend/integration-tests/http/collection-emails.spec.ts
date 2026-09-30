import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import collectionEmails from "../../src/subscribers/collection-emails"
import paymentFailedEmail from "../../src/subscribers/payment-failed-email"
import { seedTechNest } from "../../src/scripts/seed"
import { mailTo, textOf } from "../utils/mailpit"
import { placeStoreOrder } from "../utils/store-order"
import { warmDb } from "../utils/warm-db"

jest.setTimeout(300 * 1000)

const RUN = Date.now()
process.env.SHOP_NOTIFY_EMAIL = `e2-shop-coll-${RUN}@example.com`

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    describe("Click & Collect and payment-failed emails", () => {
      beforeAll(async () => {
        await seedTechNest(getContainer())
      })

      beforeEach(() => warmDb(getContainer()))

      const emit = (fn: any, name: string, order_id: string) =>
        fn({ event: { name, data: { order_id } }, container: getContainer() } as any)

      it("sends ready-for-collection with the code, then the reminder, each once", async () => {
        const email = `e2-ready-${RUN}@example.com`
        const order = await placeStoreOrder(api, getContainer(), { email, shipping: "click-collect" })
        await getContainer()
          .resolve(Modules.ORDER)
          .updateOrders([
            {
              id: order.id,
              metadata: { technest_collection_code: "K7QX4M", technest_ready_at: "2026-10-02T10:00:00.000Z" },
            },
          ])

        await emit(collectionEmails, "technest.order.ready_for_collection", order.id)
        await emit(collectionEmails, "technest.order.ready_for_collection", order.id) // duplicate event
        const [ready] = await mailTo(email, 1)
        expect(ready.Subject).toBe(`Your order #${order.display_id} is ready to collect`)
        const text = await textOf(ready.ID)
        expect(text).toContain("K7QX4M")
        expect(text).toContain("Southwark Park Rd")
        expect(text).toMatch(/Today \(\w+day\): /)
        expect(text).toContain("Friday 9 October")

        await emit(collectionEmails, "technest.order.collection_reminder", order.id)
        const subjects = (await mailTo(email, 2)).map((m) => m.Subject)
        expect(subjects).toHaveLength(2)
        expect(subjects).toContain(`Reminder: order #${order.display_id} is waiting for you`)
      })

      it("falls back to the order number when there is no collection code", async () => {
        const email = `e2-ready-nocode-${RUN}@example.com`
        const order = await placeStoreOrder(api, getContainer(), { email, shipping: "click-collect" })
        await emit(collectionEmails, "technest.order.ready_for_collection", order.id)
        const [ready] = await mailTo(email, 1)
        expect(await textOf(ready.ID)).toContain(`#${order.display_id}`)
      })

      it("tells the customer and the shop when capture fails", async () => {
        const email = `e2-payfail-${RUN}@example.com`
        const order = await placeStoreOrder(api, getContainer(), { email, shipping: "standard" })
        await emit(paymentFailedEmail, "technest.payment.capture_failed", order.id)

        const [customer] = await mailTo(email, 1)
        expect(customer.Subject).toBe(`We couldn't take payment for order #${order.display_id}`)
        const [shop] = await mailTo(process.env.SHOP_NOTIFY_EMAIL!, 1)
        expect(shop.Subject).toMatch(new RegExp(`^Payment capture FAILED: order #${order.display_id}`))
        expect(await textOf(shop.ID)).toContain("Don't ship")
      })
    })
  },
})
