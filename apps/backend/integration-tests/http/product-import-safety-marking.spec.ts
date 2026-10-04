// Chargers and power products need UKCA/CE before publishing, whatever category they are filed under:
// a CSV row with no category, or the wrong one, must not put an unmarked charger live.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { seedTechNest } from "../../src/scripts/seed"
import { adminHeaders, storeHeaders } from "../helpers/auth"
import { waitForBackgroundWork } from "../helpers/background"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

const COLUMNS = [
  "sku",
  "title",
  "handle",
  "description",
  "category",
  "price_gbp",
  "status",
  "stock",
  "reorder_level",
  "device_slugs",
  "connector_a",
  "connector_b",
  "wattage",
  "cable_length_m",
  "platform",
  "is_addon_item",
  "safety_marking",
  "warranty_months",
] as const
type Row = Partial<Record<(typeof COLUMNS)[number], string>>
const csv = (...rows: Row[]) =>
  [COLUMNS.join(","), ...rows.map((row) => COLUMNS.map((c) => row[c] ?? "").join(","))].join("\n")

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    let store: Headers

    beforeAll(async () => {
      const container = getContainer()
      await seedTechNest(container)
      admin = await adminHeaders(api, container)
      store = await storeHeaders(container)
      await waitForBackgroundWork(container)
    })

    afterEach(() => waitForBackgroundWork(getContainer()))

    /** Imports one row the way the admin Import page does and reports where the product ended up. */
    async function importRow(row: Row) {
      const file = csv(row)
      const preview = (await api.post("/admin/product-import/preview", { csv: file }, admin)).data.plan.rows[0]
      const res = await api.post("/admin/product-import", { csv: file }, admin).catch((e: any) => e.response)

      const { data } = await getContainer().resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product_variant",
        fields: ["id", "product.handle", "product.status", "product.product_attributes.safety_marking"],
        filters: { sku: row.sku },
      })
      const product = (data[0] as any)?.product
      const planRow = res.data?.plan?.rows?.[0] ?? preview
      const listed = product
        ? (await api.get(`/store/products?handle=${product.handle}&fields=id,handle`, store)).data.products.length > 0
        : false
      return {
        preview_status: (preview.status ?? null) as string | null,
        product_status: (product?.status ?? "not created") as string,
        safety_marking: (product?.product_attributes?.safety_marking ?? "none") as string,
        shoppers_can_see_it: listed,
        told_why: [...(planRow?.warnings ?? []), ...(planRow?.errors ?? [])].some((m: string) => /UKCA or CE/.test(m)),
      }
    }

    // Safe: a draft, or a refused row ("not created" / preview status null), with the safety-marking message.
    const heldBack = (outcome: Awaited<ReturnType<typeof importRow>>) => ({
      ...outcome,
      preview_status: expect.not.stringMatching(/^published$/),
      product_status: expect.not.stringMatching(/^published$/),
      shoppers_can_see_it: false,
      told_why: true,
    })

    it("control: a charger in the Chargers & Cables category with no marking is held back as a draft", async () => {
      const outcome = await importRow({
        sku: "AUD-CHG-0",
        title: "20W USB-C Charger",
        category: "chargers-cables",
        price_gbp: "9.99",
        stock: "5",
      })
      expect(outcome).toEqual(heldBack(outcome))
      expect(outcome.product_status).toBe("draft")
    })

    it("a charger with no category, blank status and no safety marking is not published", async () => {
      const outcome = await importRow({ sku: "AUD-CHG-1", title: "20W USB-C Charger", price_gbp: "9.99", stock: "5" })
      expect(outcome).toEqual(heldBack(outcome))
    })

    it("a power bank with wattage filled in, no category and no safety marking is not published", async () => {
      const outcome = await importRow({
        sku: "AUD-PB-1",
        title: "10000mAh Power Bank 20W",
        price_gbp: "14.99",
        stock: "5",
        connector_a: "USB-C",
        wattage: "20",
      })
      expect(outcome).toEqual(heldBack(outcome))
    })

    it("a charger filed under a non-power category (Cases) with no safety marking is not published", async () => {
      const outcome = await importRow({
        sku: "AUD-CHG-2",
        title: "35W Dual USB-C Wall Charger",
        category: "cases",
        price_gbp: "12.99",
        stock: "5",
      })
      expect(outcome).toEqual(heldBack(outcome))
    })
  },
})
