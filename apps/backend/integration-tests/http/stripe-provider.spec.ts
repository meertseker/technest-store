import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createRegionsWorkflow } from "@medusajs/medusa/core-flows"
import enableStripe from "../../src/scripts/enable-stripe"

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

      it("enable-stripe makes Stripe the only provider on the GBP region, idempotently", async () => {
        const container = getContainer()
        const {
          result: [region],
        } = await createRegionsWorkflow(container).run({
          input: {
            regions: [
              { name: "United Kingdom", currency_code: "gbp", countries: ["gb"], payment_providers: ["pp_system_default"] },
            ],
          },
        })

        await enableStripe({ container } as any)
        await enableStripe({ container } as any)

        const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "region",
          fields: ["payment_providers.id"],
          filters: { id: region.id },
        })
        expect((data[0].payment_providers ?? []).map((p: any) => p?.id)).toEqual(["pp_stripe_stripe"])
      })
    })
  },
})
