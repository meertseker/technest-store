import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { seedTechNest } from "../../src/scripts/seed"

jest.setTimeout(10 * 60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: { headers: Record<string, string> }

    beforeAll(async () => {
      const container = getContainer()
      await seedTechNest(container)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: keys } = await query.graph({
        entity: "api_key",
        fields: ["token"],
        filters: { type: "publishable" },
      })
      headers = { headers: { "x-publishable-api-key": keys[0].token } }
    })

    describe("store configuration seed", () => {
      it("creates a single tax-inclusive GBP region for the UK", async () => {
        const { data } = await api.get("/store/regions", headers)

        expect(data.regions).toHaveLength(1)
        const [region] = data.regions
        expect(region.name).toBe("United Kingdom")
        expect(region.currency_code).toBe("gbp")
        expect(region.countries.map((c: { iso_2: string }) => c.iso_2)).toEqual([
          "gb",
        ])

        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data: preferences } = await query.graph({
          entity: "price_preference",
          fields: ["attribute", "value", "is_tax_inclusive"],
        })
        const regionPreference = preferences.find(
          (p) => p.attribute === "region_id" && p.value === region.id
        )
        const currencyPreference = preferences.find(
          (p) => p.attribute === "currency_code" && p.value === "gbp"
        )
        expect(regionPreference?.is_tax_inclusive).toBe(true)
        expect(currencyPreference?.is_tax_inclusive).toBe(true)
      })

      it("creates the nested category tree", async () => {
        const { data } = await api.get(
          "/store/product-categories?limit=100&fields=name,handle,parent_category_id,*category_children",
          headers
        )
        const top = data.product_categories.filter(
          (c: { parent_category_id: string | null }) => !c.parent_category_id
        )
        expect(top.map((c: { name: string }) => c.name).sort()).toEqual(
          [
            "Audio",
            "Computer & Laptop",
            "Gaming",
            "Phone Accessories",
            "£1 Deals",
          ].sort()
        )

        const phone = top.find(
          (c: { handle: string }) => c.handle === "phone-accessories"
        )
        expect(
          phone.category_children.map((c: { name: string }) => c.name).sort()
        ).toEqual(
          ["Cases", "Chargers & Cables", "Power Banks", "Screen Protectors"].sort()
        )
      })

      it("seeds at least 30 published products with GBP prices", async () => {
        const { data: regions } = await api.get("/store/regions", headers)
        const regionId = regions.regions[0].id

        const { data } = await api.get(
          `/store/products?limit=100&region_id=${regionId}&fields=title,handle,+product_attributes.*,*categories,*variants.calculated_price`,
          headers
        )
        expect(data.products.length).toBeGreaterThanOrEqual(30)

        for (const product of data.products) {
          for (const variant of product.variants) {
            expect(variant.calculated_price.currency_code).toBe("gbp")
            expect(variant.calculated_price.calculated_amount).toBeGreaterThan(0)
          }
        }

        const deals = data.products.filter((p: { categories: { handle: string }[] }) =>
          p.categories.some((c) => c.handle === "1-deals")
        )
        expect(deals.length).toBeGreaterThanOrEqual(4)
        for (const deal of deals) {
          expect(deal.product_attributes.is_addon_item).toBe(true)
          expect(deal.variants[0].calculated_price.calculated_amount).toBe(1)
        }

        const powerProducts = data.products.filter(
          (p: { categories: { handle: string }[] }) =>
            p.categories.some((c) =>
              ["chargers-cables", "power-banks"].includes(c.handle)
            )
        )
        expect(powerProducts.length).toBeGreaterThanOrEqual(5)
        for (const product of powerProducts) {
          expect(["UKCA", "CE"]).toContain(product.product_attributes.safety_marking)
        }
      })

      it("offers Click & Collect, Standard and Next-day on a UK cart", async () => {
        const { data: regions } = await api.get("/store/regions", headers)
        const regionId = regions.regions[0].id

        // Below the £20 free-delivery threshold (technest-settings.spec.ts
        // covers the free Standard price above it).
        const { data: products } = await api.get(
          `/store/products?limit=100&region_id=${regionId}&fields=*variants.calculated_price`,
          headers
        )
        const variantId = products.products
          .flatMap((p: { variants: { id: string; calculated_price: { calculated_amount: number } }[] }) => p.variants)
          .find(
            (v: { calculated_price: { calculated_amount: number } }) =>
              v.calculated_price.calculated_amount < 20
          ).id

        const { data: cartRes } = await api.post(
          "/store/carts",
          {
            region_id: regionId,
            items: [{ variant_id: variantId, quantity: 1 }],
            shipping_address: { country_code: "gb", postal_code: "SE16 3TU" },
          },
          headers
        )

        const { data } = await api.get(
          `/store/shipping-options?cart_id=${cartRes.cart.id}`,
          headers
        )
        const byCode = Object.fromEntries(
          data.shipping_options.map(
            (o: { type: { code: string }; amount: number }) => [
              o.type.code,
              o.amount,
            ]
          )
        )
        expect(byCode).toEqual({
          "click-collect": 0,
          standard: 3.49,
          "next-day": 5.99,
        })
      })

      it("creates the shop stock location with the real address", async () => {
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({
          entity: "stock_location",
          fields: ["name", "address.*", "fulfillment_sets.type"],
        })
        expect(data).toHaveLength(1)
        expect(data[0].name).toBe("Tech Nest – Southwark Park Rd")
        expect(data[0].address?.postal_code).toBe("SE16 3TU")
        expect(
          data[0].fulfillment_sets?.map((f) => f?.type).sort()
        ).toEqual(["pickup", "shipping"])
      })
    })
  },
})
