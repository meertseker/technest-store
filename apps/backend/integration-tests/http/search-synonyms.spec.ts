import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedTechNest } from "../../src/scripts/seed"
import { PRODUCTS } from "../../src/scripts/seed/data"
import { storeHeaders } from "../helpers/auth"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let store: Headers

    /** Handles of the products `q` finds, as the storefront searches (prefix on the last word). */
    async function search(q: string, typo = false): Promise<{ handles: string[]; count: number }> {
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
      const result = data.results[0]
      return {
        handles: result.hits.map((h: any) => h.document.handle),
        count: result.metadata.count,
      }
    }

    beforeAll(async () => {
      const container = getContainer()
      await seedTechNest(container)
      store = await storeHeaders(container)

      // Indexing runs on product events after the seed; wait until every
      // product is indexed as published (before the runner's snapshot).
      const deadline = Date.now() + 5 * 60 * 1000
      for (;;) {
        const { count } = await search("")
        if (count === PRODUCTS.length) break
        if (Date.now() > deadline) throw new Error(`index has ${count}/${PRODUCTS.length}`)
        await new Promise((r) => setTimeout(r, 1000))
      }
    })

    it.each([
      ["plug", "dual-usb-c-car-charger-38w"],
      ["power adapter", "65w-gan-laptop-charger"],
      ["lead", "usb-c-to-lightning-cable"],
      ["wire", "usb-c-to-usb-c-braided-cable-60w"],
      ["earbuds", "wired-usb-c-earphones"],
      ["headphones", "true-wireless-earbuds"],
      ["earphones", "true-wireless-earbuds"],
      ["cover", "clear-shockproof-case"],
      ["screen guard", "privacy-glass-screen-protector"],
      ["apple", "lightning-earphones"],
      ["portable charger", "10000mah-slim-power-bank-20w"],
      ["battery pack", "20000mah-power-bank-22-5w"],
      ["type c", "wired-usb-c-earphones"],
      ["type-c cable", "usb-c-to-usb-c-braided-cable-60w"],
      ["samsung", "leather-wallet-case"],
    ])('"%s" finds %s', async (q, handle) => {
      const { handles } = await search(q)
      expect(handles).toContain(handle)
    })

    it("keeps one-way synonyms one way", async () => {
      // A USB adapter is not a charger.
      expect((await search("charger")).handles).not.toContain("usb-c-to-usb-a-adapter-2-pack")
      // Unrelated words still find nothing extra.
      expect((await search("gamepad")).handles).not.toContain("wired-usb-c-earphones")
    })

    it("indexes the synonyms field but never returns it", async () => {
      const { data } = await api.post(
        "/store/search",
        { entity: "product", filters: { q: "lead" }, search_options: { typo_tolerance: false } },
        store
      )
      expect(data.results[0].hits.length).toBeGreaterThan(0)
      for (const hit of data.results[0].hits) {
        expect(hit.document).not.toHaveProperty("synonyms")
      }
    })
  },
})
