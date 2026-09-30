import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import enableStripe from "../../src/scripts/enable-stripe"
import { seedTechNest } from "../../src/scripts/seed"
import { adminHeaders, storeHeaders } from "../helpers/auth"
import { stubStripeClient, StripeStub } from "../helpers/stripe-stub"

// Registers pp_stripe_stripe. No Stripe call is ever made: the client is stubbed.
process.env.STRIPE_API_KEY = process.env.STRIPE_API_KEY || "sk_test_integration_boot_only"
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_integration"
// The saved setting must win over the env fallback.
process.env.KLARNA_MIN_BASKET_PENCE = "3000"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    let store: Headers
    let regionId: string
    let variant: { id: string; pricePence: number }
    let stripe: StripeStub

    beforeAll(async () => {
      const container = getContainer()
      await seedTechNest(container)
      await enableStripe({ container } as any)
      admin = await adminHeaders(api, container)
      store = await storeHeaders(container)

      const { data: regions } = await api.get("/store/regions", store)
      regionId = regions.regions[0].id
      const { data } = await api.get(
        `/store/products?limit=100&region_id=${regionId}&fields=*variants.calculated_price`,
        store
      )
      const v = data.products
        .flatMap((p: any) => p.variants)
        .find((v: any) => v.calculated_price?.calculated_amount >= 5 && v.calculated_price.calculated_amount < 10)
      variant = { id: v.id, pricePence: Math.round(v.calculated_price.calculated_amount * 100) }
      stripe = stubStripeClient(container)
    })

    afterAll(() => stripe?.restore())

    /** A cart of `quantity` x the test variant, its payment collection and a Stripe session. */
    const checkout = async (quantity: number) => {
      const { data: cartRes } = await api.post(
        "/store/carts",
        { region_id: regionId, items: [{ variant_id: variant.id, quantity }] },
        store
      )
      const { data: pc } = await api.post(
        "/store/payment-collections",
        { cart_id: cartRes.cart.id },
        store
      )
      const before = stripe.created.length
      const { data } = await api.post(
        `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
        { provider_id: "pp_stripe_stripe" },
        store
      )
      const session = data.payment_collection.payment_sessions.find(
        (s: any) => s.provider_id === "pp_stripe_stripe"
      )
      expect(stripe.created.length).toBe(before + 1)
      return {
        totalPence: Math.round(cartRes.cart.total * 100),
        collectionId: pc.payment_collection.id as string,
        session,
        intentParams: stripe.created[stripe.created.length - 1],
      }
    }

    /** Smallest quantity whose basket is at least `pence`. */
    const qtyFor = (pence: number) => Math.max(1, Math.ceil(pence / variant.pricePence))

    const setKlarnaMin = async (pence: number) => {
      await api.post("/admin/technest-settings", { klarna_min_basket_pence: pence }, admin)
    }

    describe("Klarna gating on POST /store/payment-collections/:id/payment-sessions", () => {
      it("default £30: offers Klarna at or above the minimum and flags the session", async () => {
        const qty = qtyFor(3000)
        const { totalPence, session, intentParams } = await checkout(qty)

        expect(totalPence).toBeGreaterThanOrEqual(3000)
        expect(intentParams.amount).toBe(totalPence)
        expect(intentParams.capture_method).toBe("manual")
        expect(intentParams.excluded_payment_method_types).toBeUndefined()
        expect(session.data).toMatchObject({
          klarna_available: true,
          klarna_min_basket_pence: 3000,
          client_secret: expect.any(String),
        })
      })

      it("default £30: excludes Klarna below the minimum", async () => {
        const qty = qtyFor(3000) - 1
        const { totalPence, session, intentParams } = await checkout(qty)

        expect(totalPence).toBeLessThan(3000)
        expect(intentParams.excluded_payment_method_types).toEqual(["klarna"])
        expect(session.data).toMatchObject({ klarna_available: false, klarna_min_basket_pence: 3000 })
      })

      it("uses the admin setting, not the env fallback", async () => {
        // Raise the minimum above a basket that the default would allow.
        const qty = qtyFor(3000)
        const basketPence = qty * variant.pricePence
        await setKlarnaMin(basketPence + 1)

        const high = await checkout(qty)
        expect(high.intentParams.excluded_payment_method_types).toEqual(["klarna"])
        expect(high.session.data).toMatchObject({
          klarna_available: false,
          klarna_min_basket_pence: basketPence + 1,
        })

        // Lower it below a single cheap item.
        await setKlarnaMin(100)
        const low = await checkout(1)
        expect(low.intentParams.excluded_payment_method_types).toBeUndefined()
        expect(low.session.data).toMatchObject({ klarna_available: true, klarna_min_basket_pence: 100 })

        await setKlarnaMin(3000)
      })

      it("re-evaluates when the storefront re-creates the session after a basket change", async () => {
        const { collectionId } = await checkout(1)
        const first = stripe.created.length

        await setKlarnaMin(0)
        const { data } = await api.post(
          `/store/payment-collections/${collectionId}/payment-sessions`,
          { provider_id: "pp_stripe_stripe" },
          store
        )

        expect(stripe.created.length).toBe(first + 1)
        expect(data.payment_collection.payment_sessions).toHaveLength(1)
        expect(data.payment_collection.payment_sessions[0].data).toMatchObject({ klarna_available: true })
        await setKlarnaMin(3000)
      })

      it("still refuses client-sent session data (ADR 0002)", async () => {
        const { collectionId } = await checkout(1)
        const res = await api
          .post(
            `/store/payment-collections/${collectionId}/payment-sessions`,
            { provider_id: "pp_stripe_stripe", data: { klarna_min_basket_pence: 0 } },
            store
          )
          .catch((e: any) => e.response)

        expect(res.status).toBe(400)
      })

      it("keeps Medusa's validation: unknown body keys are 400", async () => {
        const { collectionId } = await checkout(1)
        const res = await api
          .post(
            `/store/payment-collections/${collectionId}/payment-sessions`,
            { provider_id: "pp_stripe_stripe", context: { technest_klarna_min_basket_pence: 0 } },
            store
          )
          .catch((e: any) => e.response)

        expect(res.status).toBe(400)
      })
    })
  },
})
