import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { seedTechNest } from "../../src/scripts/seed"
import { adminHeaders, storeHeaders } from "../helpers/auth"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    let store: Headers
    const productId: Record<string, string> = {}
    const categoryId: Record<string, string> = {}
    let draftChargerId: string

    const getStatus = async (id: string) =>
      (await api.get(`/admin/products/${id}?fields=status`, admin)).data.product.status

    beforeAll(async () => {
      const container = getContainer()
      await seedTechNest(container)
      admin = await adminHeaders(api, container)
      store = await storeHeaders(container)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: products } = await query.graph({ entity: "product", fields: ["id", "handle"] })
      for (const p of products) productId[p.handle as string] = p.id as string
      const { data: categories } = await query.graph({
        entity: "product_category",
        fields: ["id", "handle"],
      })
      for (const c of categories) categoryId[c.handle as string] = c.id as string

      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "65W GaN Charger",
              status: ProductStatus.DRAFT,
              category_ids: [categoryId["chargers-cables"]],
            },
          ],
        },
      })
      draftChargerId = result[0].id
    })

    it("seeds typed attributes and publishes the sample products", async () => {
      const [id] = Object.values(productId).filter((pid) => pid !== draftChargerId)
      expect(await getStatus(id)).toBe("published")

      const { data } = await api.get("/store/products?fields=+product_attributes.*&limit=100", store)
      const marked = data.products.filter(
        (p: any) => p.product_attributes?.safety_marking === "UKCA"
      )
      expect(marked.length).toBeGreaterThan(0)
      const addons = data.products.filter((p: any) => p.product_attributes?.is_addon_item)
      expect(addons.length).toBeGreaterThan(0)
    })

    it("returns defaults for a product with no attributes row", async () => {
      const { data } = await api.get(`/admin/products/${draftChargerId}/attributes`, admin)
      expect(data.product_attributes).toEqual({
        connector_a: null,
        connector_b: null,
        wattage: null,
        cable_length_m: null,
        platform: [],
        is_addon_item: false,
        safety_marking: "none",
        warranty_months: null,
        reorder_level: 3,
      })
    })

    it("upserts attributes partially", async () => {
      const url = `/admin/products/${draftChargerId}/attributes`
      const first = await api.post(url, { wattage: 65, connector_a: "USB-C" }, admin)
      expect(first.data.product_attributes).toMatchObject({
        wattage: 65,
        connector_a: "USB-C",
        safety_marking: "none",
      })

      const second = await api.post(url, { safety_marking: "UKCA", reorder_level: 5 }, admin)
      expect(second.data.product_attributes).toMatchObject({
        wattage: 65,
        connector_a: "USB-C",
        safety_marking: "UKCA",
        reorder_level: 5,
      })
    })

    it("rejects bad input and unknown products", async () => {
      const bad = await api
        .post(`/admin/products/${draftChargerId}/attributes`, { colour: "red" }, admin)
        .catch((e: any) => e.response)
      expect(bad.status).toBe(400)

      const marking = await api
        .post(`/admin/products/${draftChargerId}/attributes`, { safety_marking: "ukca" }, admin)
        .catch((e: any) => e.response)
      expect(marking.status).toBe(400)

      const missing = await api
        .get(`/admin/products/prod_missing/attributes`, admin)
        .catch((e: any) => e.response)
      expect(missing.status).toBe(404)
    })

    it("won't publish a charger without a safety marking, then will once it's set", async () => {
      const blocked = await api
        .post(`/admin/products/${draftChargerId}`, { status: "published" }, admin)
        .catch((e: any) => e.response)
      expect(blocked.status).toBe(400)
      expect(blocked.data.message).toContain("needs a safety marking (UKCA or CE)")
      expect(await getStatus(draftChargerId)).toBe("draft")

      await api.post(`/admin/products/${draftChargerId}/attributes`, { safety_marking: "CE" }, admin)
      const ok = await api.post(`/admin/products/${draftChargerId}`, { status: "published" }, admin)
      expect(ok.status).toBe(200)
      expect(await getStatus(draftChargerId)).toBe("published")
    })

    it("won't remove the marking from a published charger (rolled back)", async () => {
      const [chargerHandle] = Object.keys(productId).filter((h) => /charger|cable|power/.test(h))
      const id = productId[chargerHandle]
      const before = (await api.get(`/admin/products/${id}/attributes`, admin)).data
        .product_attributes.safety_marking
      expect(["UKCA", "CE"]).toContain(before)

      const res = await api
        .post(`/admin/products/${id}/attributes`, { safety_marking: "none" }, admin)
        .catch((e: any) => e.response)
      expect(res.status).toBe(400)
      const after = (await api.get(`/admin/products/${id}/attributes`, admin)).data
        .product_attributes.safety_marking
      expect(after).toBe(before)
    })

    it("won't create an unmarked power bank as published, or any vape", async () => {
      const container = getContainer()
      await expect(
        createProductsWorkflow(container).run({
          input: {
            products: [
              {
                title: "10000mAh Power Bank",
                status: ProductStatus.PUBLISHED,
                category_ids: [categoryId["power-banks"]],
              },
            ],
          },
        })
      ).rejects.toThrow("safety marking")

      await expect(
        createProductsWorkflow(container).run({
          input: { products: [{ title: "Disposable Vape 600", status: ProductStatus.PUBLISHED }] },
        })
      ).rejects.toThrow("Vapes are never sold online")

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product",
        fields: ["id"],
        filters: { title: ["10000mAh Power Bank", "Disposable Vape 600"] },
      })
      expect(data).toHaveLength(0)
    })
  },
})
