import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { cancelOrderWorkflow, updateRegionsWorkflow } from "@medusajs/medusa/core-flows"
import { seedTechNest } from "../../src/scripts/seed"
import { clearVisitorCache } from "../../src/lib/dashboard/visitors"
import { adminHeaders } from "../helpers/auth"
import { placeAuthorisedOrder, shippingOptionIdsByCode, TEST_PROVIDER_ID } from "../helpers/orders"

process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"
// Visitors come from Cloudflare; the test runs without it, as a shop that hasn't set it up.
delete process.env.CLOUDFLARE_ANALYTICS_TOKEN
delete process.env.CLOUDFLARE_ZONE_ID

jest.setTimeout(10 * 60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: { headers: Record<string, string> }
    let regionId: string
    let options: Record<string, string>

    beforeAll(async () => {
      const container = getContainer()
      const seeded = await seedTechNest(container)
      regionId = seeded.region.id
      await updateRegionsWorkflow(container).run({
        input: { selector: { id: regionId }, update: { payment_providers: [TEST_PROVIDER_ID] } },
      })
      options = await shippingOptionIdsByCode(container)
      admin = await adminHeaders(api, container)
      clearVisitorCache()
    })

    describe("GET /admin/shop-dashboard", () => {
      it("needs an admin", async () => {
        const res = await api.get("/admin/shop-dashboard").catch((e: any) => e.response)
        expect(res.status).toBe(401)
      })

      it("refuses a period it doesn't offer", async () => {
        const res = await api.get("/admin/shop-dashboard?days=12", admin).catch((e: any) => e.response)
        expect(res.status).toBe(400)
      })

      it("adds up today's orders, leaves cancelled ones out and lists the best seller", async () => {
        const container = getContainer()
        // Two delivery orders (2 x £4.99 + £3.49 = £13.47) and one cancelled Click & Collect order.
        await placeAuthorisedOrder(container, { regionId, shippingOptionId: options["standard"], shippingAmount: 3.49 })
        await placeAuthorisedOrder(container, { regionId, shippingOptionId: options["standard"], shippingAmount: 3.49 })
        const { order: cancelled } = await placeAuthorisedOrder(container, {
          regionId,
          shippingOptionId: options["click-collect"],
          shippingAmount: 0,
        })
        await cancelOrderWorkflow(container).run({ input: { order_id: cancelled.id } })

        const { data } = await api.get("/admin/shop-dashboard?days=1", admin)
        expect(data.days).toBe(1)
        expect(data.current).toEqual({
          sales_pence: 2694,
          orders: 2,
          average_order_pence: 1347,
          refunds_pence: 0,
          visitors: null,
        })
        expect(data.previous).toMatchObject({ orders: 0, sales_pence: 0 })
        expect(data.daily).toEqual([{ date: data.today, sales_pence: 2694, orders: 2, visitors: null }])
        expect(data.top_products).toEqual([{ title: "USB-C cable", quantity: 4, sales_pence: 1996 }])
        expect(data.visitors_available).toBe(false)
        expect(data.visitors_configured).toBe(false)
        expect(data.conversion_rate).toBeNull()

        // The longer periods: one row per day, today last. (The runner empties the database between tests.)
        const { data: month } = await api.get("/admin/shop-dashboard?days=30", admin)
        expect(month.daily).toHaveLength(30)
        expect(month.daily[29]).toMatchObject({ date: month.today, orders: 2 })
        expect(month.current.orders).toBe(2)
      })
    })
  },
})
