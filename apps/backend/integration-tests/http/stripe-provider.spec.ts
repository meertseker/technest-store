import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

// A syntactically valid test key is enough: the provider makes no Stripe call at boot.
process.env.STRIPE_API_KEY = process.env.STRIPE_API_KEY || "sk_test_integration_boot_only"
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_integration"

jest.setTimeout(300 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    describe("stripe payment provider registration", () => {
      it("registers pp_stripe_stripe alongside Medusa's system provider", async () => {
        const paymentModule = getContainer().resolve(Modules.PAYMENT)

        const providers = await paymentModule.listPaymentProviders({})
        const ids = providers.map((p) => p.id)

        expect(ids).toEqual(expect.arrayContaining(["pp_stripe_stripe", "pp_system_default"]))
      })
    })
  },
})
