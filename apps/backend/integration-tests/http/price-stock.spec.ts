import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { seedTechNest } from "../../src/scripts/seed"
import { adminHeaders } from "../helpers/auth"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    let productId: string
    let variantId: string

    beforeAll(async () => {
      const container = getContainer()
      await seedTechNest(container)
      admin = await adminHeaders(api, container)
      // A product with one variant, a GBP price and stock at the shop, through Quick add.
      const { data } = await api.post(
        "/admin/quick-add",
        { title: "Test cable", price: 4.99, safety_marking: "none", sku: "TEST-CABLE", stock: 3 },
        admin
      )
      productId = data.product.id
      variantId = data.product.variants[0].id
    })

    const url = () => `/admin/products/${productId}/variants/${variantId}/price-stock`
    const post = (body: unknown, u = url()) => api.post(u, body, admin).catch((e: any) => e.response)

    const read = async () => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product_variant",
        fields: [
          "id",
          "price_set.prices.id",
          "price_set.prices.amount",
          "price_set.prices.currency_code",
          "price_set.prices.price_list_id",
          "inventory_items.inventory.location_levels.stocked_quantity",
        ],
        filters: { id: variantId },
      })
      const v = data[0] as any
      const prices = v.price_set?.prices ?? []
      return {
        gbp: prices.find((p: any) => p.currency_code === "gbp" && !p.price_list_id),
        prices,
        stock: Number(v.inventory_items[0].inventory.location_levels[0].stocked_quantity),
      }
    }

    // The runner restores the database snapshot before every test, so each test
    // starts from Quick add's values: £4.99, 3 in stock.

    it("updates price and stock together: pence in and out, major units in Medusa", async () => {
      expect(Number((await read()).gbp.amount)).toBe(4.99)
      const res = await post({ price_pence: 549, stock: 7 })
      expect(res.status).toBe(200)
      expect(res.data).toEqual({ variant_id: variantId, price_pence: 549, stock: 7 })
      const v = await read()
      expect(Number(v.gbp.amount)).toBe(5.49)
      expect(v.stock).toBe(7)
    })

    it("updates one of the two and leaves the other alone, keeping the same price row", async () => {
      const before = await read()
      const res = await post({ stock: 2 })
      expect(res.data).toEqual({ variant_id: variantId, price_pence: 499, stock: 2 })
      const after = await read()
      expect(Number(after.gbp.amount)).toBe(4.99)
      expect(after.gbp.id).toBe(before.gbp.id)
      expect(after.stock).toBe(2)

      const res2 = await post({ price_pence: 1299 })
      expect(res2.data).toEqual({ variant_id: variantId, price_pence: 1299, stock: 2 })
      const last = await read()
      expect(last.gbp.id).toBe(before.gbp.id)
      expect(last.prices).toHaveLength(1)
    })

    it("keeps a price-list (trade) price when the retail price changes", async () => {
      const created = await api
        .post(
          "/admin/price-lists",
          {
            title: "Trade test",
            description: "Trade prices for the test",
            type: "sale",
            status: "active",
            prices: [{ variant_id: variantId, currency_code: "gbp", amount: 3.99 }],
          },
          admin
        )
        .catch((e: any) => e.response)
      expect([created.status, created.data?.message]).toEqual([200, undefined])
      const listId = created.data.price_list.id
      const pricing = getContainer().resolve(Modules.PRICING)
      const allPrices = async () => {
        const { data } = await getContainer().resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "product_variant", fields: ["price_set.id"], filters: { id: variantId },
        })
        const setId = (data[0] as any).price_set.id
        return pricing.listPrices({ price_set_id: [setId] } as any, { select: ["id", "amount", "currency_code", "price_list_id"], take: null })
      }
      expect((await allPrices()).map((p) => Number(p.amount)).sort()).toEqual([3.99, 4.99])

      const res = await post({ price_pence: 1499 })
      expect(res.data.price_pence).toBe(1499)
      // query.graph's price_set.prices leaves price-list prices out; the pricing module shows all.
      const after = await allPrices()
      expect(after.map((p) => Number(p.amount)).sort()).toEqual([14.99, 3.99])
      const trade = after.find((p) => (p as any).price_list_id === listId)
      expect(Number(trade!.amount)).toBe(3.99)
      expect(Number((await read()).gbp.amount)).toBe(14.99)
    })

    it("refuses bad input and changes nothing", async () => {
      for (const body of [
        {},
        { price_pence: 0 },
        { price_pence: -1 },
        { price_pence: 5.5 },
        { price_pence: "5" },
        { stock: -1 },
        { stock: 1.5 },
        { stock: 100_001 },
        { colour: "red" },
      ]) {
        const res = await post(body)
        expect([body, res.status]).toEqual([body, 400])
      }
      const v = await read()
      expect(Number(v.gbp.amount)).toBe(4.99)
      expect(v.stock).toBe(3)
    })

    it("404s a variant that is not on that product", async () => {
      const res = await post({ stock: 1 }, `/admin/products/prod_nope/variants/${variantId}/price-stock`)
      expect(res.status).toBe(404)
      const res2 = await post({ stock: 1 }, `/admin/products/${productId}/variants/variant_nope/price-stock`)
      expect(res2.status).toBe(404)
    })
  },
})
