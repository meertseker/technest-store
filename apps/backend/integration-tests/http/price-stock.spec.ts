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

    const priceSetId = async () => {
      const { data } = await getContainer().resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product_variant",
        fields: ["price_set.id"],
        filters: { id: variantId },
      })
      return (data[0] as any).price_set.id as string
    }
    const plainPrices = async () => {
      const prices = await getContainer()
        .resolve(Modules.PRICING)
        .listPrices(
          { price_set_id: [await priceSetId()], price_list_id: null } as any,
          { select: ["id", "amount", "min_quantity", "rules_count"], take: null }
        )
      return prices
        .map((p) => ({
          amount: Number(p.amount),
          min_quantity: p.min_quantity == null ? null : Number(p.min_quantity),
          rules_count: Number((p as any).rules_count ?? 0),
        }))
        .sort((a, b) => a.amount - b.amount)
    }
    const level = async () => {
      const { data } = await getContainer().resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id", "inventory_items.inventory.location_levels.*"],
        filters: { id: variantId },
      })
      const item = (data[0] as any).inventory_items[0]
      const l = item.inventory.location_levels[0]
      return {
        inventory_item_id: item.inventory_item_id as string,
        location_id: l.location_id as string,
        stocked: Number(l.stocked_quantity),
        reserved: Number(l.reserved_quantity),
      }
    }

    it("changes only the plain price: a quantity-tier price and a region price stay", async () => {
      const { data: regions } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "region", fields: ["id"] })
      await getContainer()
        .resolve(Modules.PRICING)
        .addPrices({
          priceSetId: await priceSetId(),
          prices: [
            { currency_code: "gbp", amount: 4.25, min_quantity: 10 },
            { currency_code: "gbp", amount: 4.75, rules: { region_id: regions[0].id } },
          ],
        })
      expect(await plainPrices()).toEqual([
        { amount: 4.25, min_quantity: 10, rules_count: 0 },
        { amount: 4.75, min_quantity: null, rules_count: 1 },
        { amount: 4.99, min_quantity: null, rules_count: 0 },
      ])

      const res = await post({ price_pence: 549 })

      expect(res.status).toBe(200)
      expect(res.data.price_pence).toBe(549)
      expect(await plainPrices()).toEqual([
        { amount: 4.25, min_quantity: 10, rules_count: 0 },
        { amount: 4.75, min_quantity: null, rules_count: 1 },
        { amount: 5.49, min_quantity: null, rules_count: 0 },
      ])
    })

    it("refuses to guess when a variant has two plain prices", async () => {
      await getContainer()
        .resolve(Modules.PRICING)
        .addPrices({ priceSetId: await priceSetId(), prices: [{ currency_code: "gbp", amount: 6.5 }] })
      expect((await plainPrices()).map((p) => p.amount)).toEqual([4.99, 6.5])

      const res = await post({ price_pence: 549 })

      expect({ status: res.status, message: res.data.message }).toEqual({
        status: 400,
        message: expect.stringMatching(/more than one standard price/),
      })
      expect((await plainPrices()).map((p) => p.amount)).toEqual([4.99, 6.5])
      // Stock on its own is still fine.
      expect((await post({ stock: 5 })).status).toBe(200)
    })

    it("refuses a stock number typed against stock that has since changed", async () => {
      // The page showed 3; an order then took 1.
      const l = await level()
      await getContainer().resolve(Modules.INVENTORY).adjustInventory(l.inventory_item_id, l.location_id, -1)

      const stale = await post({ stock: 8, expected_stock: 3 })
      expect({ status: stale.status, message: stale.data.message }).toEqual({
        status: 409,
        message: expect.stringMatching(/now 2, not 3/),
      })
      expect((await level()).stocked).toBe(2)

      const gone = await post({ stock: 8, expected_stock: null })
      expect(gone.status).toBe(409)

      const fresh = await post({ stock: 7, expected_stock: 2 })
      expect(fresh.status).toBe(200)
      expect(fresh.data.stock).toBe(7)
    })

    it("does not write a new price when the stock in the same request is refused", async () => {
      const res = await post({ price_pence: 999, stock: 8, expected_stock: 99 })
      expect(res.status).toBe(409)
      const v = await read()
      expect(Number(v.gbp.amount)).toBe(4.99)
      expect(v.stock).toBe(3)
    })

    it("refuses stock below what is set aside for orders not yet sent", async () => {
      const l = await level()
      await getContainer()
        .resolve(Modules.INVENTORY)
        .createReservationItems([{ inventory_item_id: l.inventory_item_id, location_id: l.location_id, quantity: 2 }])
      expect((await level()).reserved).toBe(2)

      const res = await post({ stock: 1, expected_stock: 3 })
      expect({ status: res.status, message: res.data.message }).toEqual({
        status: 400,
        message: expect.stringMatching(/2 are set aside/),
      })
      expect((await level()).stocked).toBe(3)
      expect((await post({ stock: 2, expected_stock: 3 })).status).toBe(200)
    })

    it("puts the stock back when the price write fails", async () => {
      const pricing = getContainer().resolve(Modules.PRICING) as any
      const spy = jest.spyOn(pricing, "addPrices").mockRejectedValueOnce(new Error("boom"))
      try {
        const res = await post({ price_pence: 999, stock: 9 })
        expect(res.status).toBeGreaterThanOrEqual(400)
      } finally {
        spy.mockRestore()
      }
      const v = await read()
      expect(Number(v.gbp.amount)).toBe(4.99)
      expect(v.stock).toBe(3)
    })

    it("needs an admin", async () => {
      const res = await api.post(url(), { stock: 1 }).catch((e: any) => e.response)
      expect(res.status).toBe(401)
      expect((await read()).stock).toBe(3)
    })

    it("refuses bad input and changes nothing", async () => {
      for (const body of [
        {},
        { price_pence: 0 },
        { price_pence: -1 },
        { price_pence: 5.5 },
        { price_pence: "5" },
        { price_pence: 500_001 },
        { stock: 1, expected_stock: -1 },
        { stock: 1, expected_stock: 1.5 },
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
