import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { seedTechNest } from "../../src/scripts/seed"
import { DEVICES, seedDevices } from "../../src/scripts/seed/devices"
import { storeHeaders } from "../helpers/auth"

jest.setTimeout(10 * 60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let store: { headers: Record<string, string> }
    const productIdByHandle: Record<string, string> = {}

    beforeAll(async () => {
      const container = getContainer()
      await seedTechNest(container)
      await seedDevices(container)
      store = await storeHeaders(container)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({ entity: "product", fields: ["id", "handle"] })
      for (const p of data) {
        productIdByHandle[p.handle as string] = p.id as string
      }
    })

    const fits = async (handle: string) => {
      const { data } = await api.get(`/store/products/${productIdByHandle[handle]}/devices`, store)
      return data.devices.map((d: { slug: string }) => d.slug).sort()
    }

    it("seeds the whole device catalogue with unique slugs", async () => {
      const { data } = await api.get("/store/devices", store)
      expect(data.count).toBe(DEVICES.length)
      expect(data.brands.map((b: { brand: string }) => b.brand)).toEqual([
        "Apple",
        "Samsung",
        "Google",
        "Sony",
        "Microsoft",
        "Nintendo",
      ])
    })

    it("links each product only to the models its own variants use", async () => {
      expect(await fits("leather-wallet-case")).toEqual(["galaxy-a55", "galaxy-s24"])
      expect(await fits("silicone-case-magsafe")).toEqual(["iphone-15", "iphone-16"])
      expect(await fits("20w-usb-c-fast-wall-charger")).toEqual([])
    })

    it("links console accessories through their platform attribute", async () => {
      expect(await fits("ps5-dual-controller-charging-station")).toEqual(["ps5", "ps5-pro"])
      expect(await fits("pro-controller-switch")).toEqual([
        "switch",
        "switch-2",
        "switch-lite",
        "switch-oled",
      ])
    })

    it("is a no-op when devices already exist", async () => {
      await seedDevices(getContainer())
      const { data } = await api.get("/store/devices", store)
      expect(data.count).toBe(DEVICES.length)
    })
  },
})
