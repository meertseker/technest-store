// With Stripe configured, the region created by the first `medusa db:migrate` must offer Stripe only:
// pp_system_default ("no payment") completes orders without taking money.
//
// What this suite can and cannot represent: Stripe is registered the way medusa-config.ts does in production
// (STRIPE_API_KEY set -> pp_stripe_stripe), and the region is created by the same migration script
// `medusa db:migrate` runs on a new database. NODE_ENV=production itself (Redis modules, real keys) is not
// reproduced, and the test runner does not run src/migration-scripts on its own, so the script is called here.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"
import initialDataSeed from "../../src/migration-scripts/initial-data-seed"
import stripeOnlyRegion from "../../src/migration-scripts/stripe-only-region"
import enableStripe from "../../src/scripts/enable-stripe"
import { storeHeaders } from "../helpers/auth"
import { waitForBackgroundWork } from "../helpers/background"

// As in stripe-provider.spec.ts: a syntactically valid key is enough, the provider makes no Stripe call at boot.
process.env.STRIPE_API_KEY = process.env.STRIPE_API_KEY || "sk_test_integration_boot_only"
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_integration"
// Production migrates with SEED_DEMO_DATA unset (no sample products). The region is created before, and
// independently of, that switch; the sample products are only here so a shopper has something to buy.
process.env.SEED_DEMO_DATA = "true"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

const SYSTEM_PROVIDER = "pp_system_default"
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
    let regionsBeforeSeed: number
    let variantId: string
    let standardOptionId: string

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    const gbpRegions = async () => {
      const { data } = await query().graph({
        entity: "region",
        fields: ["id", "name", "currency_code", "payment_providers.id"],
        filters: { currency_code: "gbp" },
      })
      return data.map((r: any) => ({
        id: r.id as string,
        name: r.name as string,
        payment_providers: (r.payment_providers ?? []).map((p: any) => p?.id as string).sort(),
      }))
    }

    beforeAll(async () => {
      const container = getContainer()
      regionsBeforeSeed = (await query().graph({ entity: "region", fields: ["id"] })).data.length
      // Exactly what `medusa db:migrate` runs once on a new database.
      await initialDataSeed({ container })
      store = await storeHeaders(container)

      const { data: products } = await query().graph({
        entity: "product",
        fields: ["variants.id"],
        filters: { handle: "clear-shockproof-case" },
      })
      variantId = products[0].variants![0]!.id
      const { data: options } = await query().graph({ entity: "shipping_option", fields: ["id", "type.code"] })
      standardOptionId = options.find((o: any) => o.type?.code === "standard")!.id
      await waitForBackgroundWork(container)
    })

    afterEach(() => waitForBackgroundWork(getContainer()))

    /**
     * A shopper with only the publishable key walks the checkout and asks for
     * the "no payment" provider. Reports how far they got.
     */
    async function checkoutWithSystemProvider() {
      const regionId = (await gbpRegions())[0].id
      const { data: created } = await api.post(
        "/store/carts",
        { region_id: regionId, email: "freeloader@example.com" },
        store
      )
      const cartId = created.cart.id as string
      await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantId, quantity: 1 }, store)
      await api.post(`/store/carts/${cartId}`, { shipping_address: ADDRESS, billing_address: ADDRESS }, store)
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: standardOptionId }, store)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, store)

      const session = await api
        .post(
          `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
          { provider_id: SYSTEM_PROVIDER },
          store
        )
        .catch((e: any) => e.response)
      const complete = await api.post(`/store/carts/${cartId}/complete`, {}, store).catch((e: any) => e.response)
      await waitForBackgroundWork(getContainer())

      const { data: orders } = await query().graph({
        entity: "order",
        fields: [
          "id",
          "total",
          "payment_collections.status",
          "payment_collections.payments.provider_id",
          "payment_collections.payments.captured_at",
        ],
      })
      const payment = (orders[0] as any)?.payment_collections?.[0]?.payments?.[0]
      return {
        payment_session_http_status: session.status as number,
        payment_session_error: session.status === 200 ? null : (session.data?.message as string),
        complete_result: (complete.data?.type ?? `http ${complete.status}`) as string,
        orders_created: orders.length,
        order_total: orders.length ? Number((orders[0] as any).total) : null,
        order_payment_provider: (payment?.provider_id ?? null) as string | null,
        order_marked_captured: payment ? Boolean(payment.captured_at) : null,
      }
    }

    it("control: the runner's database has no region until the seed runs, and Stripe is registered next to the system provider", async () => {
      expect(regionsBeforeSeed).toBe(0)
      const providers = await getContainer().resolve(Modules.PAYMENT).listPaymentProviders({})
      expect(providers.filter((p) => p.is_enabled).map((p) => p.id).sort()).toEqual(
        ["pp_stripe_stripe", SYSTEM_PROVIDER].sort()
      )
    })

    it("(a) the seeded GBP region does not offer the no-payment provider when Stripe is configured", async () => {
      const regions = await gbpRegions()

      expect(regions).toHaveLength(1)
      expect(regions[0].payment_providers).toEqual(["pp_stripe_stripe"])
    })

    it("(b) a shopper cannot complete a cart with a pp_system_default payment session", async () => {
      const outcome = await checkoutWithSystemProvider()

      // Refusing the session or refusing the completion are both fine; an order is not.
      expect(outcome).toEqual({
        ...outcome,
        complete_result: expect.not.stringMatching(/^order$/),
        orders_created: 0,
        order_total: null,
        order_payment_provider: null,
        order_marked_captured: null,
      })
    })

    it("mitigation check: after `medusa exec ./src/scripts/enable-stripe.ts` the same attempt is refused", async () => {
      await enableStripe({ container: getContainer() } as any)
      expect((await gbpRegions())[0].payment_providers).toEqual(["pp_stripe_stripe"])

      const outcome = await checkoutWithSystemProvider()

      expect(outcome).toMatchObject({
        payment_session_http_status: 400,
        payment_session_error: expect.stringContaining("is not enabled in the cart's region"),
        orders_created: 0,
      })
      expect(outcome.complete_result).not.toBe("order")
    })

    it("a database seeded before Stripe was configured gets Stripe only on its next migrate", async () => {
      const container = getContainer()
      const [region] = await gbpRegions()
      await updateRegionsWorkflow(container).run({
        input: { selector: { id: region.id }, update: { payment_providers: [SYSTEM_PROVIDER] } },
      })
      expect((await gbpRegions())[0].payment_providers).toEqual([SYSTEM_PROVIDER])

      await stripeOnlyRegion({ container })

      expect((await gbpRegions())[0].payment_providers).toEqual(["pp_stripe_stripe"])
    })
  },
})
