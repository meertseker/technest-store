import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { seedTechNest } from "../../src/scripts/seed"

jest.setTimeout(10 * 60 * 1000)

// What a production `db:migrate` creates (SEED_DEMO_DATA unset).
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    let first: Awaited<ReturnType<typeof seedTechNest>>

    beforeAll(async () => {
      first = await seedTechNest(getContainer(), { demo: false })
    })

    /** Row counts of everything the seed creates. */
    const snapshot = async () => {
      const container = getContainer()
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const count = async (entity: string, filters: Record<string, unknown> = {}) =>
        (await query.graph({ entity, fields: ["id"], filters })).data.length
      const fulfillment = container.resolve(Modules.FULFILLMENT)
      const { data: locations } = await query.graph({
        entity: "stock_location",
        fields: ["id", "sales_channels.id", "fulfillment_sets.id", "fulfillment_providers.id"],
      })
      const { data: keys } = await query.graph({
        entity: "api_key",
        fields: ["id", "sales_channels.id"],
        // The seed's key only (the test runner may add keys of its own).
        filters: { type: "publishable", title: "Storefront" },
      })
      return {
        stores: await count("store"),
        sales_channels: await count("sales_channel"),
        publishable_keys: keys.length,
        key_channels: keys.map((k: any) => (k.sales_channels ?? []).length),
        regions: await count("region"),
        tax_regions: await count("tax_region", { country_code: "gb" }),
        stock_locations: locations.length,
        location_links: locations.map((l: any) => [
          (l.sales_channels ?? []).length,
          (l.fulfillment_sets ?? []).length,
          (l.fulfillment_providers ?? []).length,
        ]),
        fulfillment_sets: (await fulfillment.listFulfillmentSets({})).length,
        service_zones: (await fulfillment.listServiceZones({})).length,
        shipping_options: await count("shipping_option"),
        shipping_option_types: (await fulfillment.listShippingOptionTypes({})).length,
        categories: await count("product_category"),
        products: await count("product"),
      }
    }

    it("creates the real configuration but no sample products", async () => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)

      const { data: products } = await query.graph({ entity: "product", fields: ["id"] })
      expect(products).toHaveLength(0)

      const { data: regions } = await query.graph({ entity: "region", fields: ["name"] })
      expect(regions.map((r) => r.name)).toEqual(["United Kingdom"])

      const { data: options } = await query.graph({
        entity: "shipping_option",
        fields: ["name"],
      })
      expect(options).toHaveLength(3)

      const { data: categories } = await query.graph({
        entity: "product_category",
        fields: ["handle"],
      })
      expect(categories.length).toBeGreaterThanOrEqual(18)
    })

    it("can run again (an interrupted first migrate is re-run) without creating anything twice", async () => {
      const before = await snapshot()
      expect(before).toMatchObject({
        stores: 1,
        sales_channels: 1,
        publishable_keys: 1,
        key_channels: [1],
        regions: 1,
        tax_regions: 1,
        stock_locations: 1,
        location_links: [[1, 2, 1]],
        fulfillment_sets: 2,
        service_zones: 2,
        shipping_options: 3,
        products: 0,
      })

      const second = await seedTechNest(getContainer(), { demo: false })

      expect(await snapshot()).toEqual(before)
      expect(second.region.id).toBe(first.region.id)
      expect(second.stockLocation.id).toBe(first.stockLocation.id)
      expect(second.salesChannelId).toBe(first.salesChannelId)
      expect(second.publishableApiKey.id).toBe(first.publishableApiKey.id)
    })

    it("completes a run that stopped part-way (shipping options and some categories missing)", async () => {
      const container = getContainer()
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const full = await snapshot()

      const { data: options } = await query.graph({ entity: "shipping_option", fields: ["id", "type.code"] })
      await container
        .resolve(Modules.FULFILLMENT)
        .deleteShippingOptions(options.filter((o: any) => o.type?.code !== "click-collect").map((o: any) => o.id))
      const { data: children } = await query.graph({
        entity: "product_category",
        fields: ["id", "parent_category_id"],
      })
      const someChildren = children.filter((c: any) => c.parent_category_id).slice(0, 3)
      await container.resolve(Modules.PRODUCT).deleteProductCategories(someChildren.map((c: any) => c.id))

      await seedTechNest(container, { demo: false })

      const after = await snapshot()
      expect({ ...after, shipping_option_types: 0 }).toEqual({ ...full, shipping_option_types: 0 })
      const { data: codes } = await query.graph({ entity: "shipping_option", fields: ["type.code"] })
      expect(codes.map((o: any) => o.type.code).sort()).toEqual(["click-collect", "next-day", "standard"])
    })
  },
})
