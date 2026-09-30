import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import {
  cancelOrderWorkflow,
  capturePaymentWorkflow,
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  markOrderFulfillmentAsDeliveredWorkflow,
  refundPaymentWorkflow,
} from "@medusajs/medusa/core-flows"
import orderCancelledEmail from "../../src/subscribers/order-cancelled-email"
import orderDispatchedEmail from "../../src/subscribers/order-dispatched-email"
import refundIssuedEmail from "../../src/subscribers/refund-issued-email"
import returnReceivedEmail from "../../src/subscribers/return-received-email"
import { seedTechNest } from "../../src/scripts/seed"
import { mailTo, ORDER_CONFIRMED, settle, textOf } from "../utils/mailpit"
import { orderPayment, placeStoreOrder } from "../utils/store-order"
import { warmDb } from "../utils/warm-db"
import { waitForBackgroundWork } from "../helpers/background"

jest.setTimeout(300 * 1000)

const RUN = Date.now()
process.env.SHOP_NOTIFY_EMAIL = `e2-shop-life-${RUN}@example.com`

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    describe("order lifecycle emails", () => {
      let locationId: string

      beforeAll(async () => {
        const { stockLocation } = await seedTechNest(getContainer())
        locationId = stockLocation.id
      })

      beforeEach(() => warmDb(getContainer()))

      const run = (fn: any, name: string, data: object) =>
        fn({ event: { name, data }, container: getContainer() } as any)

      async function fulfil(orderId: string) {
        // The order module fills items.quantity from the item detail (query.graph
        // with only "items.quantity" leaves it undefined).
        const order = await getContainer().resolve(Modules.ORDER).retrieveOrder(orderId, { relations: ["items"] })
        const items = (order.items ?? []).map((i) => ({ id: i.id, quantity: Number(i.quantity) }))
        const { result: fulfillment } = await createOrderFulfillmentWorkflow(getContainer()).run({
          input: { order_id: orderId, items, location_id: locationId },
        })
        return { fulfillment, items }
      }

      it("emails tracking details when a shipment is created", async () => {
        const email = `e2-dispatch-${RUN}@example.com`
        const order = await placeStoreOrder(api, getContainer(), { email, shipping: "standard" })
        const { fulfillment, items } = await fulfil(order.id)
        await createOrderShipmentWorkflow(getContainer()).run({
          input: {
            order_id: order.id,
            fulfillment_id: fulfillment.id,
            items,
            labels: [
              { tracking_number: "RM123GB", tracking_url: "https://track.example/RM123GB", label_url: "https://x.example" },
            ],
          },
        })
        await run(orderDispatchedEmail, "shipment.created", { id: fulfillment.id })

        const [mail] = await mailTo(email, 1, { ignore: ORDER_CONFIRMED })
        expect(mail.Subject).toBe(`Your order #${order.display_id} is on its way`)
        const text = await textOf(mail.ID)
        expect(text).toContain("RM123GB")
        expect(text).toContain("1 High St")
      })

      it("sends nothing for a shipment marked no_notification", async () => {
        const email = `e2-dispatch-quiet-${RUN}@example.com`
        await run(orderDispatchedEmail, "shipment.created", { id: "ful_x", no_notification: true })
        expect(await settle(email, 2000, { ignore: ORDER_CONFIRMED })).toHaveLength(0)
      })

      it("tells the customer an uncollected order was cancelled and the hold released", async () => {
        const email = `e2-cancel-${RUN}@example.com`
        const order = await placeStoreOrder(api, getContainer(), { email, shipping: "click-collect" })
        await getContainer()
          .resolve(Modules.ORDER)
          .updateOrders([{ id: order.id, metadata: { collection_expired_at: "2026-10-09T10:00:00.000Z" } }])
        await cancelOrderWorkflow(getContainer()).run({ input: { order_id: order.id } })
        await run(orderCancelledEmail, "order.canceled", { id: order.id })

        const [mail] = await mailTo(email, 1, { ignore: ORDER_CONFIRMED })
        expect(mail.Subject).toBe(`Your order #${order.display_id} has been cancelled`)
        const text = await textOf(mail.ID)
        expect(text).toContain("collected within 7 days")
        expect(text).toContain("been charged")
      })

      it("sends one refund email per refund, with the amount", async () => {
        const email = `e2-refund-${RUN}@example.com`
        const order = await placeStoreOrder(api, getContainer(), { email, shipping: "standard" })
        const payment = await orderPayment(getContainer(), order.id)
        // The order.placed subscriber captures delivery orders in the background. Let it finish
        // first, and only capture here if it did not (two captures would race and one would fail).
        await waitForBackgroundWork(getContainer())
        const paymentModule = getContainer().resolve(Modules.PAYMENT)
        const [current] = await paymentModule.listPayments({ id: [payment.id] })
        if (!current.captured_at) {
          await capturePaymentWorkflow(getContainer()).run({ input: { payment_id: payment.id } })
        }

        await refundPaymentWorkflow(getContainer()).run({ input: { payment_id: payment.id, amount: 1 } })
        await run(refundIssuedEmail, "payment.refunded", { id: payment.id })
        const [first] = await mailTo(email, 1, { ignore: ORDER_CONFIRMED })
        expect(first.Subject).toBe(`Refund of £1.00 for order #${order.display_id}`)
        expect(await textOf(first.ID)).toMatch(/5–10\s+working days/)

        // A second partial refund gets its own email; the first isn't resent.
        await refundPaymentWorkflow(getContainer()).run({ input: { payment_id: payment.id, amount: 2 } })
        await run(refundIssuedEmail, "payment.refunded", { id: payment.id })
        await run(refundIssuedEmail, "payment.refunded", { id: payment.id })
        await settle(email, 1500, { ignore: ORDER_CONFIRMED })
        const subjects = (await mailTo(email, 2, { ignore: ORDER_CONFIRMED })).map((m) => m.Subject).sort()
        expect(subjects).toEqual([
          `Refund of £1.00 for order #${order.display_id}`,
          `Refund of £2.00 for order #${order.display_id}`,
        ])
      })

      it("confirms a received return", async () => {
        const email = `e2-return-${RUN}@example.com`
        const order = await placeStoreOrder(api, getContainer(), { email, shipping: "standard" })
        const { fulfillment, items } = await fulfil(order.id)
        await markOrderFulfillmentAsDeliveredWorkflow(getContainer()).run({
          input: { orderId: order.id, fulfillmentId: fulfillment.id },
        })
        // createAndCompleteReturnOrderWorkflow needs a return shipping option,
        // which the seed doesn't have; the email only needs a received return.
        const orders = getContainer().resolve(Modules.ORDER)
        const ret = await orders.createReturn({ order_id: order.id, items, location_id: locationId })
        await orders.receiveReturn({ return_id: ret.id, items })
        await run(returnReceivedEmail, "order.return_received", { order_id: order.id, return_id: ret.id })

        const [mail] = await mailTo(email, 1, { ignore: ORDER_CONFIRMED })
        expect(mail.Subject).toBe(`We've received your return for order #${order.display_id}`)
        expect(await textOf(mail.ID)).toContain("14 days")
      })
    })
  },
})
