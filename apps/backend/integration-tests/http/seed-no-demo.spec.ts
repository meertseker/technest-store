import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { seedTechNest } from "../../src/scripts/seed"

jest.setTimeout(10 * 60 * 1000)

// What a production `db:migrate` creates (SEED_DEMO_DATA unset).
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    beforeAll(async () => {
      await seedTechNest(getContainer(), { demo: false })
    })

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
  },
})
