import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { seedTechNest } from "../../src/scripts/seed"
import { IMPORT_TEMPLATE_CSV } from "../../src/admin/routes/import/template"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../src/modules/product-attributes"
import { adminHeaders } from "../helpers/auth"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

const HEADER =
  "sku,title,handle,description,category,price_gbp,status,stock,reorder_level,device_slugs,connector_a,connector_b,wattage,cable_length_m,platform,is_addon_item,safety_marking,warranty_months"
const csv = (...rows: string[]) => [HEADER, ...rows].join("\n")

const NEW_CABLE =
  "IMP-CBL-1,Import Test Cable 1m,,Braided.,chargers-cables,3.49,published,12,5,iphone-16-pro,USB-C,Lightning,20,1,,no,UKCA,12"
const NEW_CASE = "IMP-CASE-1,Import Test Case,,,cases,6.99,,4,,,,,,,,,,"

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    let locationId: string
    let multiVariantSku: string
    let multiVariantProductId: string

    const variantBySku = async (sku: string) => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product_variant",
        fields: [
          "id",
          "sku",
          "prices.amount",
          "prices.currency_code",
          "product.id",
          "product.title",
          "product.handle",
          "product.status",
          "product.categories.handle",
          "product.sales_channels.id",
          "product.product_attributes.*",
          "inventory_items.inventory.location_levels.location_id",
          "inventory_items.inventory.location_levels.stocked_quantity",
        ],
        filters: { sku },
      })
      return data[0] as any
    }
    const stockOf = (variant: any) =>
      variant.inventory_items[0].inventory.location_levels.find(
        (l: any) => l.location_id === locationId
      )?.stocked_quantity
    const productCount = async () =>
      (await api.get("/admin/products?limit=1", admin)).data.count as number
    const devicesOf = async (productId: string) =>
      (await api.get(`/admin/products/${productId}/devices`, admin)).data.devices.map(
        (d: any) => d.slug
      )

    beforeAll(async () => {
      const container = getContainer()
      const seeded = await seedTechNest(container)
      locationId = seeded.stockLocation.id
      admin = await adminHeaders(api, container)

      for (const body of [
        { brand: "Apple", series: "iPhone 16", model: "iPhone 16", type: "phone" },
        { brand: "Apple", series: "iPhone 16", model: "iPhone 16 Pro", type: "phone" },
      ]) {
        await api.post("/admin/devices", body, admin)
      }

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product",
        fields: ["id", "variants.sku"],
      })
      const multi = data.find((p: any) => p.variants.length > 1) as any
      multiVariantProductId = multi.id
      multiVariantSku = multi.variants[0].sku
    })

    describe("auth", () => {
      it("needs an admin session", async () => {
        const res = await api
          .post("/admin/product-import/preview", { csv: csv(NEW_CASE) })
          .catch((e: any) => e.response)
        expect(res.status).toBe(401)
      })
    })

    describe("POST /admin/product-import/preview", () => {
      it("lists what each row would do and writes nothing", async () => {
        const before = await productCount()
        const { data } = await api.post(
          "/admin/product-import/preview",
          {
            csv: csv(
              NEW_CABLE,
              "IMP-VAPE-1,Disposable Vape 600,,,,4.99,draft,1,,,,,,,,,,",
              "IMP-PLUG-1,Import Plug 20W,,,chargers-cables,9.99,published,3,,,,,,,,,,",
              `${multiVariantSku},,,,,2.50,,7,,,,,,,,,,`
            ),
          },
          admin
        )
        expect(data.plan.summary).toMatchObject({ rows: 4, create: 2, update: 1, error: 1, draft: 1 })
        expect(data.plan.rows.map((r: any) => [r.line, r.action, r.status])).toEqual([
          [2, "create", "published"],
          [3, "error", null],
          [4, "create", "draft"],
          [5, "update", "published"],
        ])
        expect(data.plan.rows[1].errors[0]).toMatch(/vape/i)
        expect(data.plan.rows[2].warnings[0]).toMatch(/UKCA or CE/)
        expect(await productCount()).toBe(before)
      })

      it("reports file-level problems", async () => {
        const { data } = await api.post("/admin/product-import/preview", { csv: "title\nA" }, admin)
        expect(data.plan.file_errors[0]).toMatch(/no "sku" column/)
      })

      it("validates the body", async () => {
        const res = await api
          .post("/admin/product-import/preview", { csv: "" }, admin)
          .catch((e: any) => e.response)
        expect(res.status).toBe(400)
      })

      it("accepts the downloadable template", async () => {
        const { data } = await api.post(
          "/admin/product-import/preview",
          { csv: IMPORT_TEMPLATE_CSV },
          admin
        )
        expect(data.plan.file_errors).toEqual([])
        expect(data.plan.summary).toMatchObject({ rows: 3, create: 3, error: 0 })
      })
    })

    describe("POST /admin/product-import", () => {
      it("creates products with price, stock, attributes and device links", async () => {
        const { data } = await api.post(
          "/admin/product-import",
          { csv: csv(NEW_CABLE, NEW_CASE) },
          admin
        )
        expect(data).toMatchObject({ created: 2, updated: 0, skipped: 0 })

        const cable = await variantBySku("IMP-CBL-1")
        expect(cable.product).toMatchObject({
          title: "Import Test Cable 1m",
          handle: "import-test-cable-1m",
          status: "published",
          categories: [{ handle: "chargers-cables" }],
        })
        expect(cable.product.sales_channels).toHaveLength(1)
        // GBP major units, as-is: 3.49 stays 3.49.
        expect(cable.prices).toEqual([expect.objectContaining({ currency_code: "gbp", amount: 3.49 })])
        expect(stockOf(cable)).toBe(12)
        expect(cable.product.product_attributes).toMatchObject({
          connector_a: "USB-C",
          connector_b: "Lightning",
          wattage: 20,
          cable_length_m: 1,
          safety_marking: "UKCA",
          warranty_months: 12,
          reorder_level: 5,
          is_addon_item: false,
        })
        expect(await devicesOf(cable.product.id)).toEqual(["iphone-16-pro"])

        const kase = await variantBySku("IMP-CASE-1")
        expect(kase.product.status).toBe("published")
        expect(stockOf(kase)).toBe(4)
      })

      it("is an idempotent upsert by SKU", async () => {
        const file = csv(NEW_CABLE, NEW_CASE)
        await api.post("/admin/product-import", { csv: file }, admin)
        const count = await productCount()

        const { data } = await api.post("/admin/product-import", { csv: file }, admin)
        expect(data).toMatchObject({ created: 0, updated: 2, skipped: 0 })
        expect(await productCount()).toBe(count)

        const cable = await variantBySku("IMP-CBL-1")
        expect(cable.prices).toHaveLength(1)
        expect(cable.prices[0].amount).toBe(3.49)
        expect(stockOf(cable)).toBe(12)
        expect(await devicesOf(cable.product.id)).toEqual(["iphone-16-pro"])
      })

      it("updates only the filled-in columns of an existing SKU", async () => {
        await api.post("/admin/product-import", { csv: csv(NEW_CABLE) }, admin)
        await api.post(
          "/admin/product-import",
          { csv: csv("IMP-CBL-1,,,,,4.25,,30,,iphone-16;iphone-16-pro,,,,,,,,") },
          admin
        )
        const cable = await variantBySku("IMP-CBL-1")
        expect(cable.product.title).toBe("Import Test Cable 1m")
        expect(cable.product.status).toBe("published")
        expect(cable.prices[0].amount).toBe(4.25)
        expect(stockOf(cable)).toBe(30)
        expect(cable.product.product_attributes.safety_marking).toBe("UKCA")
        expect((await devicesOf(cable.product.id)).sort()).toEqual(["iphone-16", "iphone-16-pro"])
      })

      it("imports chargers without a safety marking as drafts, and skips vapes", async () => {
        const { data } = await api.post(
          "/admin/product-import",
          {
            csv: csv(
              "IMP-PLUG-1,Import Plug 20W,,,chargers-cables,9.99,published,3,,,,,,,,,,",
              "IMP-VAPE-1,Disposable Vape 600,,,,4.99,draft,1,,,,,,,,,,"
            ),
          },
          admin
        )
        expect(data).toMatchObject({ created: 1, updated: 0, skipped: 1 })
        expect((await variantBySku("IMP-PLUG-1")).product.status).toBe("draft")
        expect(await variantBySku("IMP-VAPE-1")).toBeUndefined()

        // Adding the marking later publishes it.
        await api.post(
          "/admin/product-import",
          { csv: csv("IMP-PLUG-1,,,,,,published,,,,,,,,,,CE,") },
          admin
        )
        expect((await variantBySku("IMP-PLUG-1")).product.status).toBe("published")
      })

      it("only changes price and stock on a SKU of a multi-option product", async () => {
        const before = await variantBySku(multiVariantSku)
        const { data } = await api.post(
          "/admin/product-import",
          { csv: csv(`${multiVariantSku},Renamed,,,,2.50,draft,7,,,,,,,,,,`) },
          admin
        )
        expect(data.updated).toBe(1)
        expect(data.plan.rows[0].warnings[0]).toMatch(/only its price and stock/)
        const after = await variantBySku(multiVariantSku)
        expect(after.product.id).toBe(multiVariantProductId)
        expect(after.product.title).toBe(before.product.title)
        expect(after.product.status).toBe(before.product.status)
        expect(after.prices[0].amount).toBe(2.5)
        expect(stockOf(after)).toBe(7)
      })

      it("refuses a file with file-level errors", async () => {
        const res = await api
          .post("/admin/product-import", { csv: "title\nA" }, admin)
          .catch((e: any) => e.response)
        expect(res.status).toBe(400)
        expect(res.data.message).toMatch(/no "sku" column/)
      })

      it("rolls every row back when a later step fails", async () => {
        const service = getContainer().resolve(PRODUCT_ATTRIBUTES_MODULE) as any
        const spy = jest
          .spyOn(service, "createProductAttributes")
          .mockRejectedValueOnce(new Error("boom"))
        const count = await productCount()
        try {
          const res = await api
            .post("/admin/product-import", { csv: csv(NEW_CABLE, NEW_CASE) }, admin)
            .catch((e: any) => e.response)
          expect(res.status).toBeGreaterThanOrEqual(400)
        } finally {
          spy.mockRestore()
        }
        expect(await productCount()).toBe(count)
        expect(await variantBySku("IMP-CBL-1")).toBeUndefined()
      })
    })
  },
})
