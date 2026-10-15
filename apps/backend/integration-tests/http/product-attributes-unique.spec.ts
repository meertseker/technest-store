import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MedusaAppLoader } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../src/modules/product-attributes"
import {
  ensureOneAttributesRowPerProduct,
  productAttributesLinkTable,
} from "../../src/lib/product-attributes-unique"
import { adminHeaders } from "../helpers/auth"

jest.setTimeout(10 * 60 * 1000)

// The product <-> attributes link is one-to-one, but the table Medusa generates
// only has a composite primary key. The database must refuse a second live
// attributes row for one product, whoever writes it.
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    const live = async (table: string, productId: string) =>
      (
        await getContainer()
          .resolve(ContainerRegistrationKeys.PG_CONNECTION)
          .raw(`select product_attributes_id from "${table}" where product_id = ? and deleted_at is null`, [productId])
      ).rows as { product_attributes_id: string }[]

    const productIdIndex = async (table: string) =>
      (
        await getContainer()
          .resolve(ContainerRegistrationKeys.PG_CONNECTION)
          .raw(`select indexname, indexdef from pg_indexes where tablename = ? and indexname like 'IDX_product_id_%'`, [table])
      ).rows as { indexname: string; indexdef: string }[]

    it("allows one live attributes row per product, cleaning up an existing duplicate once", async () => {
      const container = getContainer()
      const admin = await adminHeaders(api, container)
      const products = container.resolve(Modules.PRODUCT)
      const attributes = container.resolve(PRODUCT_ATTRIBUTES_MODULE) as any
      const link = container.resolve(ContainerRegistrationKeys.LINK)
      const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
      const [a, b] = await products.createProducts([{ title: "Cable A" }, { title: "Cable B" }])

      await api.post(`/admin/products/${a.id}/attributes`, { wattage: 20 }, admin)
      const table = await productAttributesLinkTable(container)
      const [{ product_attributes_id: firstRowId }] = await live(table, a.id)

      // Medusa's link service checks for an existing link before it inserts,
      // but two writers racing past the workflow lock (an import and a save)
      // can both pass that check. Write the second link the way the loser of
      // that race would: straight into the table.
      const insertLink = (attributesId: string) =>
        pg.raw(`insert into "${table}" (id, product_id, product_attributes_id) values (?, ?, ?)`, [
          `test_${attributesId}`,
          a.id,
          attributesId,
        ])
      const stray = await attributes.createProductAttributes({ wattage: 99 })
      await insertLink(stray.id)
      expect(await live(table, a.id)).toHaveLength(2)

      expect(await ensureOneAttributesRowPerProduct(container)).toEqual({ changed: true, duplicates_removed: 1 })
      expect((await live(table, a.id)).map((r) => r.product_attributes_id)).toEqual([firstRowId])
      const [index] = await productIdIndex(table)
      expect(index.indexdef).toMatch(/^CREATE UNIQUE INDEX/)
      expect(index.indexdef).toContain("WHERE (deleted_at IS NULL)")

      // Now the database refuses a second row for the same product...
      const another = await attributes.createProductAttributes({ wattage: 5 })
      await expect(insertLink(another.id)).rejects.toMatchObject({ code: "23505" })
      await expect(
        link.create({
          [Modules.PRODUCT]: { product_id: a.id },
          [PRODUCT_ATTRIBUTES_MODULE]: { product_attributes_id: another.id },
        })
      ).rejects.toBeTruthy()
      expect(await live(table, a.id)).toHaveLength(1)

      // ...while normal saves keep working, also two at once for a new product.
      const [s1, s2] = await Promise.all([
        api.post(`/admin/products/${b.id}/attributes`, { wattage: 30 }, admin).catch((e: any) => e.response),
        api.post(`/admin/products/${b.id}/attributes`, { cable_length_m: 2 }, admin).catch((e: any) => e.response),
      ])
      expect([s1.status, s2.status]).toContain(200)
      expect(await live(table, b.id)).toHaveLength(1)
      const again = await api.post(`/admin/products/${a.id}/attributes`, { wattage: 25 }, admin)
      expect(again.data.product_attributes).toMatchObject({ wattage: 25 })
      expect((await live(table, a.id)).map((r) => r.product_attributes_id)).toEqual([firstRowId])

      // Running it again changes nothing.
      expect(await ensureOneAttributesRowPerProduct(container)).toEqual({ changed: false, duplicates_removed: 0 })
    })

    it("survives the link sync that every db:migrate runs", async () => {
      const container = getContainer()
      const table = await productAttributesLinkTable(container)
      await ensureOneAttributesRowPerProduct(container)

      // The runner clears the link registry after its own sync; register our
      // link definitions again (they register themselves when loaded) so the
      // planner sees what `db:migrate` sees.
      if (!(global as any).MedusaModule.getCustomLinks().length) {
        jest.isolateModules(() => {
          require("../../src/links/product-attributes")
          require("../../src/links/product-device")
        })
      }
      const planner = await new MedusaAppLoader({ cwd: process.cwd() }).getLinksExecutionPlanner()
      const plan = await planner.createPlan()
      const ours = plan.find((p: any) => p.tableName === table)
      expect(ours?.action).toBe("noop")
      const [index] = await productIdIndex(table)
      expect(index.indexdef).toMatch(/^CREATE UNIQUE INDEX/)
    })
  },
})
