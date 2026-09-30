import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { seedTechNest } from "../../src/scripts/seed"
import { seedDevices } from "../../src/scripts/seed/devices"
import { adminHeaders, storeHeaders } from "../helpers/auth"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

/** The smallest valid product body: one option, one variant. */
const oneVariant = {
  options: [{ title: "Default", values: ["Default"] }],
  variants: [{ title: "Default", options: { Default: "Default" }, prices: [] }],
}

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
      await seedDevices(container)
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
              ...oneVariant,
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
      // Every seeded product has a row; the draft charger (no row) isn't listed.
      expect(data.products.every((p: any) => p.product_attributes)).toBe(true)

      const one = await api.get(
        `/store/products/${productId["20w-usb-c-fast-wall-charger"]}?fields=product_attributes.safety_marking,product_attributes.wattage`,
        store
      )
      expect(one.data.product.product_attributes).toMatchObject({
        safety_marking: "UKCA",
        wattage: 20,
      })

      // Device listing (same core query config) exposes them too; the seed
      // links console products by their `platform` attribute.
      const ps5 = await api.get("/store/devices/ps5/products?fields=+product_attributes.*", store)
      expect(ps5.data.products.length).toBeGreaterThan(0)
      for (const p of ps5.data.products) {
        expect(p.product_attributes).toBeTruthy()
      }
      expect(
        ps5.data.products.some((p: any) => p.product_attributes.platform.includes("ps5"))
      ).toBe(true)
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
      const id = productId["20w-usb-c-fast-wall-charger"]
      const before = (await api.get(`/admin/products/${id}/attributes`, admin)).data
        .product_attributes
      expect(["UKCA", "CE"]).toContain(before.safety_marking)

      const res = await api
        .post(`/admin/products/${id}/attributes`, { safety_marking: "none", wattage: 99 }, admin)
        .catch((e: any) => e.response)
      expect(res.status).toBe(400)
      expect(res.data.type).toBe("invalid_data")
      const after = (await api.get(`/admin/products/${id}/attributes`, admin)).data
        .product_attributes
      expect(after).toEqual(before)
    })

    it("rolls back a new row and its link when the guard fails", async () => {
      // A legacy published charger with no row (written past the workflows).
      const container = getContainer()
      const productModule = container.resolve(Modules.PRODUCT)
      const legacy = await productModule.createProducts({
        title: "Legacy 18W Plug",
        status: ProductStatus.PUBLISHED,
        category_ids: [categoryId["chargers-cables"]],
      })

      const res = await api
        .post(`/admin/products/${legacy.id}/attributes`, { wattage: 18 }, admin)
        .catch((e: any) => e.response)
      expect(res.status).toBe(400)
      expect(res.data.message).toContain("needs a safety marking")

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product",
        fields: ["id", "product_attributes.id"],
        filters: { id: legacy.id },
      })
      expect((data[0] as any).product_attributes ?? null).toBeNull()

      // Setting the marking in the same save is allowed.
      const ok = await api.post(
        `/admin/products/${legacy.id}/attributes`,
        { wattage: 18, safety_marking: "UKCA" },
        admin
      )
      expect(ok.data.product_attributes).toMatchObject({ wattage: 18, safety_marking: "UKCA" })
    })

    it("guards the native admin create, update and batch routes", async () => {
      const created = await api
        .post(
          "/admin/products",
          {
            title: "30W USB-C Plug",
            status: "published",
            categories: [{ id: categoryId["chargers-cables"] }],
            ...oneVariant,
          },
          admin
        )
        .catch((e: any) => e.response)
      expect(created.status).toBe(400)
      expect(created.data.message).toContain("needs a safety marking (UKCA or CE)")

      // Moving a published, unmarked product into Gaming > Charging is refused.
      const caseId = productId[Object.keys(productId).find((h) => /case/.test(h))!]
      const moved = await api
        .post(
          `/admin/products/${caseId}`,
          { categories: [{ id: categoryId["gaming-charging"] }] },
          admin
        )
        .catch((e: any) => e.response)
      expect(moved.status).toBe(400)
      const { data: stillCase } = await api.get(
        `/admin/products/${caseId}?fields=categories.handle`,
        admin
      )
      expect(stillCase.product.categories.map((c: any) => c.handle)).not.toContain(
        "gaming-charging"
      )

      const batch = await api
        .post(
          "/admin/products/batch",
          {
            create: [
              {
                title: "Magsafe Power Bank",
                status: "published",
                categories: [{ id: categoryId["power-banks"] }],
                ...oneVariant,
              },
            ],
          },
          admin
        )
        .catch((e: any) => e.response)
      expect(batch.status).toBe(400)
    })

    it("guards adding published products to a charger category from the category page", async () => {
      const caseId = productId[Object.keys(productId).find((h) => /case/.test(h))!]
      const url = `/admin/product-categories/${categoryId["chargers-cables"]}/products`

      const unauthenticated = await api
        .post(url, { add: [caseId] })
        .catch((e: any) => e.response)
      expect(unauthenticated.status).toBe(401)

      const refused = await api.post(url, { add: [caseId] }, admin).catch((e: any) => e.response)
      expect(refused.status).toBe(400)
      expect(refused.data.message).toContain("needs a safety marking")
      // Rolled back: the product did not join the category.
      const { data: notMoved } = await api.get(
        `/admin/products/${caseId}?fields=categories.handle`,
        admin
      )
      expect(notMoved.product.categories.map((c: any) => c.handle)).not.toContain(
        "chargers-cables"
      )

      await api.post(`/admin/products/${caseId}/attributes`, { safety_marking: "UKCA" }, admin)
      const ok = await api.post(url, { add: [caseId] }, admin)
      expect(ok.status).toBe(200)
      expect(ok.data.product_category.id).toBe(categoryId["chargers-cables"])
      const { data: moved } = await api.get(
        `/admin/products/${caseId}?fields=categories.handle`,
        admin
      )
      expect(moved.product.categories.map((c: any) => c.handle)).toContain("chargers-cables")
    })

    it("never publishes a vape through the admin API", async () => {
      const { data } = await api.post(
        "/admin/products",
        {
          title: "Mint Pod 10ml",
          handle: "mint-e-liquid-10ml",
          status: "draft",
          ...oneVariant,
        },
        admin
      )
      const id = data.product.id

      const publish = await api
        .post(`/admin/products/${id}`, { status: "published" }, admin)
        .catch((e: any) => e.response)
      expect(publish.status).toBe(400)
      expect(publish.data.message).toContain("Vapes are never sold online")
      expect(await getStatus(id)).toBe("draft")

      // A safety marking doesn't help a vape.
      await api.post(`/admin/products/${id}/attributes`, { safety_marking: "UKCA" }, admin)
      const again = await api
        .post(`/admin/products/${id}`, { status: "published" }, admin)
        .catch((e: any) => e.response)
      expect(again.status).toBe(400)

      const attrs = await api
        .get(`/admin/products/${id}/attributes`)
        .catch((e: any) => e.response)
      expect(attrs.status).toBe(401)
    })

    it("won't create an unmarked power bank as published, or any vape", async () => {
      const container = getContainer()
      // Workflow errors aren't Error instances, so compare messages.
      const failure = (p: Promise<unknown>) =>
        p.then(
          () => "did not throw",
          (e: any) => String(e?.message ?? e)
        )

      expect(
        await failure(
          createProductsWorkflow(container).run({
          input: {
            products: [
              {
                title: "10000mAh Power Bank",
                status: ProductStatus.PUBLISHED,
                category_ids: [categoryId["power-banks"]],
                ...oneVariant,
              },
            ],
          },
        })
        )
      ).toContain("safety marking")

      expect(
        await failure(
          createProductsWorkflow(container).run({
            input: {
              products: [
                { title: "Disposable Vape 600", status: ProductStatus.PUBLISHED, ...oneVariant },
              ],
            },
          })
        )
      ).toContain("Vapes are never sold online")

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
