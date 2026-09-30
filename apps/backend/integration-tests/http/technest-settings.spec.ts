import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { seedTechNest } from "../../src/scripts/seed"
import { getTechnestSettings } from "../../src/modules/settings/get-settings"
import {
  TECHNEST_SETTINGS_UPDATED,
  updateTechnestSettingsWorkflow,
} from "../../src/workflows/update-technest-settings"
import { adminHeaders, storeHeaders } from "../helpers/auth"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

const DEFAULTS = {
  free_delivery_threshold_pence: 2000,
  klarna_min_basket_pence: 3000,
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    let store: Headers
    let regionId: string
    /** A stocked variant under £10 and its price in pence. */
    let cheap: { variantId: string; pricePence: number }

    beforeAll(async () => {
      const container = getContainer()
      await seedTechNest(container)
      admin = await adminHeaders(api, container)
      store = await storeHeaders(container)

      const { data: regions } = await api.get("/store/regions", store)
      regionId = regions.regions[0].id
      const { data } = await api.get(
        `/store/products?limit=100&region_id=${regionId}&fields=*variants.calculated_price`,
        store
      )
      const variants = data.products.flatMap(
        (p: { variants: { id: string; calculated_price: { calculated_amount: number } }[] }) =>
          p.variants
      )
      const variant = variants.find(
        (v: { calculated_price: { calculated_amount: number } }) =>
          v.calculated_price.calculated_amount >= 5 &&
          v.calculated_price.calculated_amount < 10
      )
      cheap = {
        variantId: variant.id,
        pricePence: Math.round(variant.calculated_price.calculated_amount * 100),
      }
    })

    /** Shipping option amounts (major units) by type code for a new cart. */
    const shippingFor = async (quantity: number) => {
      const { data: cartRes } = await api.post(
        "/store/carts",
        {
          region_id: regionId,
          items: [{ variant_id: cheap.variantId, quantity }],
          shipping_address: { country_code: "gb", postal_code: "SE16 3TU" },
        },
        store
      )
      const { data } = await api.get(
        `/store/shipping-options?cart_id=${cartRes.cart.id}`,
        store
      )
      return {
        itemTotalPence: Math.round(cartRes.cart.item_total * 100),
        amounts: Object.fromEntries(
          data.shipping_options.map((o: { type: { code: string }; amount: number }) => [
            o.type.code,
            o.amount,
          ])
        ) as Record<string, number>,
      }
    }

    /** Smallest quantity of the cheap variant whose total reaches `pence`. */
    const qtyReaching = (pence: number) => Math.ceil(pence / cheap.pricePence)

    const status = (p: Promise<unknown>) =>
      p.then(
        () => 200,
        (e: { response?: { status: number; data: { type?: string } } }) => e.response!.status
      )

    describe("GET /store/technest-settings", () => {
      it("returns every key with defaults and a 60 s cache header", async () => {
        const res = await api.get("/store/technest-settings", store)
        expect(res.status).toBe(200)
        expect(res.data).toEqual({ settings: DEFAULTS })
        expect(res.headers["cache-control"]).toBe("public, max-age=60")
      })

      it("requires the publishable key", async () => {
        expect(await status(api.get("/store/technest-settings"))).toBe(400)
      })
    })

    describe("admin routes", () => {
      it("reject unauthenticated requests with 401", async () => {
        expect(await status(api.get("/admin/technest-settings"))).toBe(401)
        expect(
          await status(
            api.post("/admin/technest-settings", { klarna_min_basket_pence: 1 })
          )
        ).toBe(401)
      })

      it("GET returns the defaults", async () => {
        const { data } = await api.get("/admin/technest-settings", admin)
        expect(data).toEqual({ settings: DEFAULTS })
      })

      it("POST updates only the given keys and emits technest.settings.updated", async () => {
        const events: unknown[] = []
        const eventBus = getContainer().resolve(Modules.EVENT_BUS)
        eventBus.subscribe(TECHNEST_SETTINGS_UPDATED, async (event: { data: unknown }) => {
          events.push(event.data)
        })

        const { data } = await api.post(
          "/admin/technest-settings",
          { klarna_min_basket_pence: 3500 },
          admin
        )
        expect(data).toEqual({
          settings: { free_delivery_threshold_pence: 2000, klarna_min_basket_pence: 3500 },
        })

        const { data: again } = await api.post(
          "/admin/technest-settings",
          { free_delivery_threshold_pence: 2500 },
          admin
        )
        expect(again.settings).toEqual({
          free_delivery_threshold_pence: 2500,
          klarna_min_basket_pence: 3500,
        })

        const { data: storeData } = await api.get("/store/technest-settings", store)
        expect(storeData.settings).toEqual(again.settings)
        expect(await getTechnestSettings(getContainer())).toEqual(again.settings)

        for (let i = 0; i < 50 && events.length < 2; i++) {
          await new Promise((r) => setTimeout(r, 100))
        }
        expect(events).toEqual([
          { keys: ["klarna_min_basket_pence"] },
          { keys: ["free_delivery_threshold_pence"] },
        ])
      })

      it.each([
        [{ free_delivery_threshold_pence: 2000, colour: "red" }, "unknown key"],
        [{ free_delivery_threshold_pence: 19.99 }, "not an integer"],
        [{ free_delivery_threshold_pence: -1 }, "negative"],
        [{ klarna_min_basket_pence: 100001 }, "over £1000"],
        [{ klarna_min_basket_pence: "3000" }, "a string"],
        [{}, "empty body"],
      ])("POST rejects %j (%s) with 400 invalid_data", async (body) => {
        const err = await api
          .post("/admin/technest-settings", body, admin)
          .catch((e: { response: { status: number; data: { type: string } } }) => e.response)
        expect(err.status).toBe(400)
        expect(err.data.type).toBe("invalid_data")
        const { data } = await api.get("/admin/technest-settings", admin)
        expect(data.settings).toEqual(DEFAULTS)
      })

      it("POST accepts the bounds 0 and 100000", async () => {
        const { data } = await api.post(
          "/admin/technest-settings",
          { free_delivery_threshold_pence: 0, klarna_min_basket_pence: 100000 },
          admin
        )
        expect(data.settings).toEqual({
          free_delivery_threshold_pence: 0,
          klarna_min_basket_pence: 100000,
        })
      })
    })

    describe("free Standard delivery", () => {
      it("seeds the default £20 threshold: normal price below, £0 at or above", async () => {
        const below = await shippingFor(qtyReaching(2000) - 1)
        expect(below.itemTotalPence).toBeLessThan(2000)
        expect(below.amounts).toEqual({ "click-collect": 0, standard: 3.49, "next-day": 5.99 })

        const above = await shippingFor(qtyReaching(2000))
        expect(above.itemTotalPence).toBeGreaterThanOrEqual(2000)
        expect(above.amounts).toEqual({ "click-collect": 0, standard: 0, "next-day": 5.99 })
      })

      it("follows a saved threshold, inclusive at exactly the threshold", async () => {
        // Threshold = exactly two items: the boundary must count as free.
        const exact = cheap.pricePence * 2
        await api.post(
          "/admin/technest-settings",
          { free_delivery_threshold_pence: exact },
          admin
        )
        expect((await shippingFor(1)).amounts.standard).toBe(3.49)
        const atThreshold = await shippingFor(2)
        expect(atThreshold.itemTotalPence).toBe(exact)
        expect(atThreshold.amounts).toEqual({
          "click-collect": 0,
          standard: 0,
          "next-day": 5.99,
        })

        // Raising it replaces the old rule (no stale £0 price left behind).
        await api.post(
          "/admin/technest-settings",
          { free_delivery_threshold_pence: exact + 1 },
          admin
        )
        expect((await shippingFor(2)).amounts.standard).toBe(3.49)
        expect((await shippingFor(3)).amounts.standard).toBe(0)

        // Exactly one £0 twin per normal price (currency + region).
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data: options } = await query.graph({
          entity: "shipping_option",
          fields: ["type.code", "prices.id", "prices.amount", "prices.price_rules.*"],
        })
        const standard = options.find((o) => o.type?.code === "standard")!
        const amounts = (standard.prices ?? []).map((p) => Number(p!.amount)).sort()
        expect(amounts).toEqual([0, 0, 3.49, 3.49])
      })

      it("a klarna-only save leaves shipping prices alone", async () => {
        await api.post("/admin/technest-settings", { klarna_min_basket_pence: 100 }, admin)
        expect((await shippingFor(qtyReaching(2000))).amounts.standard).toBe(0)
        expect((await shippingFor(qtyReaching(2000) - 1)).amounts.standard).toBe(3.49)
      })
    })

    describe("compensation", () => {
      it("rolls the saved values back when the shipping price update fails", async () => {
        const container = getContainer()
        // One key already saved (update path) and one not yet (create path).
        await api.post("/admin/technest-settings", { klarna_min_basket_pence: 4000 }, admin)

        const pricing = container.resolve(Modules.PRICING)
        const spy = jest
          .spyOn(pricing, "updatePriceSets")
          .mockRejectedValueOnce(new Error("pricing unavailable"))
        try {
          // The error comes from another realm (jest vm), so match its message
          // rather than using toThrow (which needs an Error instance).
          const error = await updateTechnestSettingsWorkflow(container)
            .run({
              input: { free_delivery_threshold_pence: 5000, klarna_min_basket_pence: 4500 },
            })
            .then(
              () => null,
              (e: { message?: string }) => e
            )
          expect(error?.message).toBe("pricing unavailable")
          expect(spy).toHaveBeenCalledTimes(1)
        } finally {
          spy.mockRestore()
        }

        expect(await getTechnestSettings(container)).toEqual({
          free_delivery_threshold_pence: 2000,
          klarna_min_basket_pence: 4000,
        })
        const { data } = await api.get("/admin/technest-settings", admin)
        expect(data.settings.free_delivery_threshold_pence).toBe(2000)
        expect((await shippingFor(qtyReaching(2000))).amounts.standard).toBe(0)

        // The lock was released: a normal save still works.
        const { data: saved } = await api.post(
          "/admin/technest-settings",
          { free_delivery_threshold_pence: 2200 },
          admin
        )
        expect(saved.settings.free_delivery_threshold_pence).toBe(2200)
      })
    })
  },
})
