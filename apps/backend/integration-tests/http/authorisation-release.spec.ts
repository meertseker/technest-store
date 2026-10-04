// A cancelled order must not keep a hold on the shopper's card. When the release failed at the time
// (payment provider down), the job tries again on its later runs.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { releaseStuckAuthorisations } from "../../src/lib/authorisation-release"
import { seedTechNest } from "../../src/scripts/seed"
import { paymentOf, placeAuthorisedOrder, shippingOptionIdsByCode } from "../helpers/orders"
import {
  failNextPaymentCall,
  recordedPaymentCalls,
  resetPaymentRecorder,
} from "../helpers/recording-payment-provider"

process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"

jest.setTimeout(10 * 60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    let regionId: string
    let options: Record<string, string>

    beforeAll(async () => {
      const container = getContainer()
      regionId = (await seedTechNest(container)).region.id
      options = await shippingOptionIdsByCode(container)
    })

    beforeEach(() => resetPaymentRecorder())

    const order = () =>
      placeAuthorisedOrder(getContainer(), {
        regionId,
        shippingOptionId: options["click-collect"],
        shippingAmount: 0,
      })
    /** The order is cancelled but its payment was never released (the release failed at the time). */
    const cancelledWithHold = async () => {
      const placed = await order()
      await getContainer().resolve(Modules.ORDER).cancel(placed.order.id)
      return placed
    }
    const cancels = () => recordedPaymentCalls().filter((c) => c.method === "cancelPayment").length
    const run = () => releaseStuckAuthorisations(getContainer(), new Date())

    it("releases the hold of a cancelled order that still has one", async () => {
      const { payment_id } = await cancelledWithHold()

      expect(await run()).toEqual({ released: 1, failed: 0 })

      expect((await paymentOf(getContainer(), payment_id)).canceled_at).toBeTruthy()
      expect(cancels()).toBe(1)
      // Nothing left to do on the next run.
      expect(await run()).toEqual({ released: 0, failed: 0 })
      expect(cancels()).toBe(1)
    })

    it("reports a release that fails again and succeeds on a later run", async () => {
      const { payment_id } = await cancelledWithHold()
      failNextPaymentCall("cancelPayment")

      expect(await run()).toEqual({ released: 0, failed: 1 })
      expect((await paymentOf(getContainer(), payment_id)).canceled_at).toBeFalsy()

      expect(await run()).toEqual({ released: 1, failed: 0 })
      expect((await paymentOf(getContainer(), payment_id)).canceled_at).toBeTruthy()
    })

    it("leaves live orders and captured payments alone", async () => {
      const live = await order()
      const captured = await order()
      await capturePaymentWorkflow(getContainer()).run({ input: { payment_id: captured.payment_id } })
      await getContainer().resolve(Modules.ORDER).cancel(captured.order.id)
      resetPaymentRecorder()

      expect(await run()).toEqual({ released: 0, failed: 0 })

      expect(recordedPaymentCalls()).toEqual([])
      expect((await paymentOf(getContainer(), live.payment_id)).canceled_at).toBeFalsy()
    })
  },
})
