import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
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
    // Import and fail with the server's message (axios hides the body).
    const importCsv = async (file: string) => {
      try {
        return (await api.post("/admin/product-import", { csv: file }, admin)).data
      } catch (e: any) {
        throw new Error(`import failed: ${e.response?.status} ${JSON.stringify(e.response?.data)}`)
      }
    }
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
        {
          brand: "Apple",
          series: "iPhone 16",
          model: "iPhone 16",
          type: "phone",
        },
        {
          brand: "Apple",
          series: "iPhone 16",
          model: "iPhone 16 Pro",
          type: "phone",
        },
      ]) {
        await api.post("/admin/devices", body, admin)
      }

      // A product with two options, and a EUR price next to the GBP one
      // (the import must leave prices it doesn't manage alone).
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: profiles } = await query.graph({
        entity: "shipping_profile",
        fields: ["id"],
      })
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "Import Test Two-Colour Case",
              handle: "import-test-two-colour-case",
              status: ProductStatus.PUBLISHED,
              shipping_profile_id: profiles[0].id,
              sales_channels: [{ id: seeded.salesChannelId }],
              options: [{ title: "Colour", values: ["Black", "Blue"] }],
              variants: ["Black", "Blue"].map((colour) => ({
                title: colour,
                sku: `IMP-MULTI-${colour.toUpperCase()}`,
                options: { Colour: colour },
                manage_inventory: true,
                prices: [
                  { currency_code: "gbp", amount: 5 },
                  { currency_code: "eur", amount: 6 },
                ],
              })),
            },
          ],
        },
      })
      multiVariantProductId = result[0].id
      multiVariantSku = "IMP-MULTI-BLACK"
    })

    describe("auth and limits", () => {
      it("needs an admin session on both routes", async () => {
        for (const url of ["/admin/product-import/preview", "/admin/product-import"]) {
          const res = await api.post(url, { csv: csv(NEW_CASE) }).catch((e: any) => e.response)
          expect(res.status).toBe(401)
        }
        // A customer token isn't an admin session either.
        const res = await api
          .post(
            "/admin/product-import",
            { csv: csv(NEW_CASE) },
            {
              headers: { authorization: "Bearer not-a-token" },
            }
          )
          .catch((e: any) => e.response)
        expect(res.status).toBe(401)
        expect(await variantBySku("IMP-CASE-1")).toBeUndefined()
      })

      it("accepts a big file (over the default 100 kB body limit)", async () => {
        const filler = "x".repeat(300)
        const rows = Array.from(
          { length: 1000 },
          (_, i) => `IMP-BIG-${i},Big ${i},,${filler},,1.50,draft,,,,,,,,,,,`
        )
        const { data } = await api.post(
          "/admin/product-import/preview",
          { csv: csv(...rows) },
          admin
        )
        expect(data.plan.summary).toMatchObject({
          rows: 1000,
          create: 1000,
          error: 0,
        })
      })

      it("refuses a file over the size and row limits", async () => {
        const tooLong = await api
          .post("/admin/product-import/preview", { csv: "sku\n" + "x".repeat(2_000_001) }, admin)
          .catch((e: any) => e.response)
        expect(tooLong.status).toBe(400)

        const tooBig = await api
          .post("/admin/product-import/preview", { csv: "x".repeat(6 * 1024 * 1024) }, admin)
          .catch((e: any) => e.response)
        expect(tooBig.status).toBe(413)

        const tooMany = await api
          .post(
            "/admin/product-import",
            {
              csv: csv(...Array.from({ length: 2001 }, (_, i) => `IMP-N-${i},N,,,,1,,,,,,,,,,,,`)),
            },
            admin
          )
          .catch((e: any) => e.response)
        expect(tooMany.status).toBe(400)
        expect(tooMany.data.message).toMatch(/at most 2000/)
      })

      it("refuses unknown body keys", async () => {
        const res = await api
          .post("/admin/product-import/preview", { csv: csv(NEW_CASE), plan: {} }, admin)
          .catch((e: any) => e.response)
        expect(res.status).toBe(400)
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
        expect(data.plan.summary).toMatchObject({
          rows: 4,
          create: 2,
          update: 1,
          error: 1,
          draft: 1,
        })
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
        expect(data.plan.summary).toMatchObject({
          rows: 3,
          create: 3,
          error: 0,
        })
      })
    })

    describe("POST /admin/product-import", () => {
      it("creates products with price, stock, attributes and device links", async () => {
        const data = await importCsv(csv(NEW_CABLE, NEW_CASE))
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
        expect(cable.prices).toEqual([
          expect.objectContaining({ currency_code: "gbp", amount: 3.49 }),
        ])
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
        await importCsv(file)
        const count = await productCount()

        const data = await importCsv(file)
        expect(data).toMatchObject({ created: 0, updated: 2, skipped: 0 })
        expect(await productCount()).toBe(count)

        const cable = await variantBySku("IMP-CBL-1")
        expect(cable.prices).toHaveLength(1)
        expect(cable.prices[0].amount).toBe(3.49)
        expect(stockOf(cable)).toBe(12)
        expect(await devicesOf(cable.product.id)).toEqual(["iphone-16-pro"])
      })

      it("updates only the filled-in columns of an existing SKU", async () => {
        await importCsv(csv(NEW_CABLE))
        await importCsv(csv("IMP-CBL-1,,,,,4.25,,30,,iphone-16;iphone-16-pro,,,,,,,,"))
        const cable = await variantBySku("IMP-CBL-1")
        expect(cable.product.title).toBe("Import Test Cable 1m")
        expect(cable.product.status).toBe("published")
        expect(cable.prices[0].amount).toBe(4.25)
        expect(stockOf(cable)).toBe(30)
        expect(cable.product.product_attributes.safety_marking).toBe("UKCA")
        expect((await devicesOf(cable.product.id)).sort()).toEqual(["iphone-16", "iphone-16-pro"])
      })

      it("imports chargers without a safety marking as drafts, and skips vapes", async () => {
        const data = await importCsv(
          csv(
            "IMP-PLUG-1,Import Plug 20W,,,chargers-cables,9.99,published,3,,,,,,,,,,",
            "IMP-VAPE-1,Disposable Vape 600,,,,4.99,draft,1,,,,,,,,,,"
          )
        )
        expect(data).toMatchObject({ created: 1, updated: 0, skipped: 1 })
        expect((await variantBySku("IMP-PLUG-1")).product.status).toBe("draft")
        expect(await variantBySku("IMP-VAPE-1")).toBeUndefined()

        // Adding the marking later publishes it.
        await importCsv(csv("IMP-PLUG-1,,,,,,published,,,,,,,,,,CE,"))
        expect((await variantBySku("IMP-PLUG-1")).product.status).toBe("published")
      })

      it("only changes price and stock on a SKU of a multi-option product", async () => {
        const before = await variantBySku(multiVariantSku)
        const data = await importCsv(csv(`${multiVariantSku},Renamed,,,,2.50,draft,7,,,,,,,,,,`))
        expect(data.updated).toBe(1)
        expect(data.plan.rows[0].warnings[0]).toMatch(/only its price and stock/)
        const after = await variantBySku(multiVariantSku)
        expect(after.product.id).toBe(multiVariantProductId)
        expect(after.product.title).toBe(before.product.title)
        expect(after.product.status).toBe(before.product.status)
        const byCurrency = Object.fromEntries(
          after.prices.map((p: any) => [p.currency_code, p.amount])
        )
        expect(byCurrency).toEqual({ gbp: 2.5, eur: 6 })
        expect(stockOf(after)).toBe(7)
        // The other option is untouched.
        const other = await variantBySku("IMP-MULTI-BLUE")
        expect(other.prices.find((p: any) => p.currency_code === "gbp").amount).toBe(5)
      })

      it("refuses a file with file-level errors", async () => {
        const count = await productCount()
        const res = await api
          .post("/admin/product-import", { csv: "title\nA" }, admin)
          .catch((e: any) => e.response)
        expect(res.status).toBe(400)
        expect(res.data.type).toBe("invalid_data")
        expect(res.data.message).toMatch(/no "sku" column/)
        expect(await productCount()).toBe(count)
      })

      it("hides a live charger whose marking is removed, and keeps an update-only file working", async () => {
        await importCsv(csv(NEW_CABLE))
        const data = await importCsv(csv("IMP-CBL-1,,,,,,,,,,,,,,,,none,"))
        expect(data).toMatchObject({ created: 0, updated: 1 })
        expect(data.plan.rows[0].warnings[0]).toMatch(/now hidden/)
        const cable = await variantBySku("IMP-CBL-1")
        expect(cable.product.status).toBe("draft")
        expect(cable.product.product_attributes.safety_marking).toBe("none")
      })

      it("stores prices as typed in pounds (never x100)", async () => {
        await importCsv(
          csv(
            "IMP-PENNY-1,Penny Sweets,,,,0.01,draft,,,,,,,,,,,",
            "IMP-CHG-65,65W Charger,,,,39.99,draft,,,,,,,,,,,"
          )
        )
        expect((await variantBySku("IMP-PENNY-1")).prices[0].amount).toBe(0.01)
        expect((await variantBySku("IMP-CHG-65")).prices[0].amount).toBe(39.99)
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

      it("restores existing products when the last step fails", async () => {
        await importCsv(csv(NEW_CABLE))
        const inventory = getContainer().resolve(Modules.INVENTORY) as any
        const spy = jest
          .spyOn(inventory, "updateInventoryLevels")
          .mockRejectedValueOnce(new Error("boom"))
        try {
          const res = await api
            .post(
              "/admin/product-import",
              {
                csv: csv(
                  "IMP-CBL-1,Renamed Cable,,,cases,9.99,draft,50,,iphone-16,USB-A,,,,,,CE,",
                  NEW_CASE
                ),
              },
              admin
            )
            .catch((e: any) => e.response)
          expect(res.status).toBeGreaterThanOrEqual(400)
        } finally {
          spy.mockRestore()
        }
        const cable = await variantBySku("IMP-CBL-1")
        expect(cable.product).toMatchObject({
          title: "Import Test Cable 1m",
          status: "published",
          categories: [{ handle: "chargers-cables" }],
        })
        expect(cable.prices).toEqual([expect.objectContaining({ amount: 3.49 })])
        expect(stockOf(cable)).toBe(12)
        expect(cable.product.product_attributes).toMatchObject({
          connector_a: "USB-C",
          safety_marking: "UKCA",
        })
        expect(await devicesOf(cable.product.id)).toEqual(["iphone-16-pro"])
        expect(await variantBySku("IMP-CASE-1")).toBeUndefined()
      })
    })
  },
})
