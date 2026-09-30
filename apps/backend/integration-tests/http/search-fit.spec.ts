import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { seedTechNest } from "../../src/scripts/seed"
import { PRODUCTS } from "../../src/scripts/seed/data"
import { seedDevices } from "../../src/scripts/seed/devices"
import { adminHeaders, storeHeaders } from "../helpers/auth"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

// Seed products and the devices each one fits (by its variants' "Model" values).
const IPHONE_ONLY = ["clear-shockproof-case", "silicone-case-magsafe", "privacy-glass-screen-protector", "camera-lens-protector"]
const GALAXY_ONLY = ["leather-wallet-case"]
const BOTH = ["rugged-armour-case", "tempered-glass-screen-protector-2-pack"]

// Exactly what a product hit returned before this change (storefront contract).
const HIT_FIELDS = [
  "category",
  "created_at",
  "description",
  "handle",
  "id",
  "labels",
  "max_price_gbp",
  "min_price_gbp",
  "on_sale_gbp",
  "option_values",
  "original_price_gbp",
  "thumbnail",
  "title",
]

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let store: Headers
    let admin: Headers

    async function searchHits(q: string, typo = false): Promise<any[]> {
      const { data } = await api.post(
        "/store/search",
        {
          entity: "product",
          filters: { q },
          pagination: { take: 100 },
          search_options: { match_strategy: "last", typo_tolerance: typo, count: "exact" },
        },
        store
      )
      return data.results[0].hits.map((h: any) => h.document)
    }

    /** Handles of the products `q` finds, as the storefront searches (prefix on the last word). */
    const search = async (q: string, typo = false) =>
      (await searchHits(q, typo)).map((d) => d.handle as string)

    async function waitFor(what: string, check: () => Promise<boolean>) {
      const deadline = Date.now() + 2 * 60 * 1000
      while (!(await check())) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
        await new Promise((r) => setTimeout(r, 500))
      }
    }

    async function productId(handle: string): Promise<string> {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({ entity: "product", fields: ["id"], filters: { handle } })
      return data[0].id as string
    }

    beforeAll(async () => {
      const container = getContainer()
      await seedTechNest(container)
      await seedDevices(container)
      store = await storeHeaders(container)
      admin = await adminHeaders(api, container, "search-fit@technest.test")

      // Indexing runs on events after the seed. Wait until every product is
      // indexed, and the device links too (a PS4 controller never says "PlayStation").
      const deadline = Date.now() + 5 * 60 * 1000
      for (;;) {
        const all = await search("")
        const linked = await search("playstation")
        if (all.length === PRODUCTS.length && linked.includes("wireless-controller-ps4")) break
        if (Date.now() > deadline) {
          throw new Error(`index has ${all.length}/${PRODUCTS.length}, playstation: ${linked}`)
        }
        await new Promise((r) => setTimeout(r, 1000))
      }
    })

    it('"iphone 15" finds cases for the iPhone 15, not Galaxy-only ones', async () => {
      const handles = await search("iphone 15")
      expect(handles).toEqual(
        expect.arrayContaining(["clear-shockproof-case", "silicone-case-magsafe", "tempered-glass-screen-protector-2-pack"])
      )
      expect(handles).not.toContain("leather-wallet-case")
      expect(handles).not.toContain("rugged-armour-case") // iPhone 16 Pro Max / Galaxy S25 Ultra
    })

    it.each(["apple", "iphone"])('"%s" finds iPhone products and no Galaxy-only ones', async (q) => {
      const handles = await search(q)
      expect(handles).toEqual(expect.arrayContaining([...IPHONE_ONLY, ...BOTH]))
      for (const handle of GALAXY_ONLY) expect(handles).not.toContain(handle)
    })

    it.each(["galaxy", "samsung"])('"%s" finds Galaxy products and no iPhone-only ones', async (q) => {
      for (const typo of [false, true]) {
        const handles = await search(q, typo)
        expect(handles).toEqual(expect.arrayContaining([...GALAXY_ONLY, ...BOTH]))
        for (const handle of IPHONE_ONLY) expect(handles).not.toContain(handle)
      }
    })

    it('"galaxy s24" finds the S24 case only among cases', async () => {
      const handles = await search("galaxy s24")
      expect(handles).toContain("leather-wallet-case")
      for (const handle of [...IPHONE_ONLY, ...BOTH]) expect(handles).not.toContain(handle)
    })

    it("finds products by linked devices their text never names", async () => {
      expect(await search("sony")).toContain("wireless-controller-ps4")
      expect(await search("nintendo")).toContain("pro-controller-switch")
    })

    it("still applies synonyms, including to device names", async () => {
      expect(await search("cover")).toContain("leather-wallet-case")
      expect(await search("samsung cover")).toContain("leather-wallet-case")
      expect(await search("apple cover")).not.toContain("leather-wallet-case")
      expect(await search("lead")).toContain("usb-c-to-lightning-cable")
    })

    it("returns only the option values the product's own variants use", async () => {
      const [hit] = (await searchHits("silicone case magsafe")).filter(
        (d) => d.handle === "silicone-case-magsafe"
      )
      expect(hit.option_values.filter((v: string) => v.startsWith("Model:")).sort()).toEqual([
        "Model:iPhone 15",
        "Model:iPhone 16",
      ])
    })

    it("keeps the hit document shape the storefront reads", async () => {
      const hits = await searchHits("case")
      expect(hits.length).toBeGreaterThan(0)
      for (const hit of hits) {
        expect(Object.keys(hit).sort()).toEqual(HIT_FIELDS)
        expect(Array.isArray(hit.option_values)).toBe(true)
      }
    })

    it("re-indexes a product when its device links change", async () => {
      const ringHolder = await productId("phone-ring-holder")
      expect(await search("galaxy")).not.toContain("phone-ring-holder")

      const { data: devices } = await api.get("/admin/devices?q=galaxy-s24", admin)
      const s24 = devices.devices.find((d: any) => d.slug === "galaxy-s24")
      await api.post(`/admin/products/${ringHolder}/devices`, { add: [{ device_id: s24.id }] }, admin)
      await waitFor("link to be indexed", async () => (await search("galaxy s24")).includes("phone-ring-holder"))

      await api.post(`/admin/products/${ringHolder}/devices`, { remove: [s24.id] }, admin)
      await waitFor("unlink to be indexed", async () => !(await search("galaxy")).includes("phone-ring-holder"))
    })

    it("re-indexes linked products when a device is renamed or deleted", async () => {
      const lanyard = await productId("phone-wrist-lanyard")
      const { data: created } = await api.post(
        "/admin/devices",
        { brand: "Qorvex", series: "Qorvex Z", model: "Qorvex Z9", type: "phone", aliases: ["gr1yh"] },
        admin
      )
      const device = created.device
      await api.post(`/admin/products/${lanyard}/devices`, { add: [{ device_id: device.id }] }, admin)
      await waitFor("link to be indexed", async () => (await search("qorvex z9")).includes("phone-wrist-lanyard"))

      await api.post(`/admin/devices/${device.id}`, { aliases: ["zyxfitalias"] }, admin)
      await waitFor("rename to be indexed", async () => (await search("zyxfitalias")).includes("phone-wrist-lanyard"))
      expect(await search("gr1yh")).not.toContain("phone-wrist-lanyard")

      await api.delete(`/admin/devices/${device.id}`, admin)
      await waitFor("delete to be indexed", async () => !(await search("qorvex")).includes("phone-wrist-lanyard"))
    })
  },
})
