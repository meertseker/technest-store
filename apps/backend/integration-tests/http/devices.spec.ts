import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { seedTechNest } from "../../src/scripts/seed"
import { setProductDevicesWorkflow } from "../../src/workflows/set-product-devices"
import { adminHeaders, storeHeaders } from "../helpers/auth"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

// The runner snapshots the DB after beforeAll and restores it before every
// test, so fixtures live in beforeAll and each test starts from them.
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    let store: Headers
    let regionId: string
    const productIdByHandle: Record<string, string> = {}
    const device: Record<string, { id: string; slug: string }> = {}

    const newDevice = (over: Record<string, unknown> = {}) => ({
      brand: "Apple",
      series: "iPhone 16",
      model: "iPhone 16 Pro",
      type: "phone",
      aliases: ["16 pro", "A3101"],
      release_year: 2024,
      ...over,
    })

    beforeAll(async () => {
      const container = getContainer()
      const seeded = await seedTechNest(container)
      regionId = seeded.region.id
      admin = await adminHeaders(api, container)
      store = await storeHeaders(container)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({ entity: "product", fields: ["id", "handle"] })
      for (const p of data) {
        productIdByHandle[p.handle as string] = p.id as string
      }

      for (const body of [
        newDevice(),
        newDevice({ model: "iPhone 16", aliases: [] }),
        newDevice({ brand: "Sony", series: "PlayStation", model: "PS5", type: "console", aliases: ["playstation 5"], release_year: 2020 }),
        newDevice({ model: "iPhone 11", series: "iPhone 11", aliases: [], release_year: 2019 }),
      ]) {
        const { data: created } = await api.post("/admin/devices", body, admin)
        device[created.device.slug] = created.device
      }

      await api.post(
        `/admin/products/${productIdByHandle["clear-shockproof-case"]}/devices`,
        { add: [{ device_id: device["iphone-16"].id, note: "Slim fit" }, { device_id: device["iphone-16-pro"].id }] },
        admin
      )
      await api.post(
        `/admin/products/${productIdByHandle["wireless-controller-ps4"]}/devices`,
        { add: [{ device_id: device["ps5"].id }] },
        admin
      )
    })

    describe("admin device CRUD", () => {
      it("created devices with generated slugs and full fields", async () => {
        const { data } = await api.get(`/admin/devices/${device["iphone-16-pro"].id}`, admin)
        expect(data.device).toMatchObject({
          id: expect.stringMatching(/^dev_/),
          brand: "Apple",
          series: "iPhone 16",
          model: "iPhone 16 Pro",
          slug: "iphone-16-pro",
          aliases: ["16 pro", "A3101"],
          type: "phone",
          release_year: 2024,
          image_url: null,
        })
      })

      it("rejects a duplicate slug with 400", async () => {
        const err = await api
          .post("/admin/devices", newDevice(), admin)
          .catch((e: any) => e.response)
        expect(err.status).toBe(400)
        expect(err.data.message).toContain("iphone-16-pro")
      })

      it("rejects an invalid type with 400", async () => {
        const err = await api
          .post("/admin/devices", newDevice({ model: "Fridge", type: "fridge" }), admin)
          .catch((e: any) => e.response)
        expect(err.status).toBe(400)
      })

      it("requires admin auth", async () => {
        const err = await api.get("/admin/devices").catch((e: any) => e.response)
        expect(err.status).toBe(401)
      })

      it("lists, filters and paginates", async () => {
        const all = await api.get("/admin/devices?order=model", admin)
        expect(all.data.count).toBe(4)
        expect(all.data.devices.map((d: any) => d.model)).toEqual(["iPhone 11", "iPhone 16", "iPhone 16 Pro", "PS5"])

        const consoles = await api.get("/admin/devices?type=console", admin)
        expect(consoles.data.devices.map((d: any) => d.slug)).toEqual(["ps5"])

        const search = await api.get("/admin/devices?q=a3101", admin)
        expect(search.data.devices.map((d: any) => d.slug)).toEqual(["iphone-16-pro"])

        const page = await api.get("/admin/devices?limit=1&offset=1&order=-release_year", admin)
        expect(page.data).toMatchObject({ count: 4, limit: 1, offset: 1 })
        expect(page.data.devices).toHaveLength(1)
      })

      it("updates a device and rejects a slug clash or unknown id", async () => {
        const { data } = await api.post(`/admin/devices/${device["ps5"].id}`, { aliases: ["ps5 slim", "cfi-2016"] }, admin)
        expect(data.device.aliases).toEqual(["ps5 slim", "cfi-2016"])
        expect(data.device.model).toBe("PS5")

        const clash = await api
          .post(`/admin/devices/${device["ps5"].id}`, { slug: "iphone-16" }, admin)
          .catch((e: any) => e.response)
        expect(clash.status).toBe(400)

        const own = await api.post(`/admin/devices/${device["ps5"].id}`, { slug: "ps5" }, admin)
        expect(own.data.device.slug).toBe("ps5")

        const missing = await api
          .post("/admin/devices/dev_missing", { model: "x" }, admin)
          .catch((e: any) => e.response)
        expect(missing.status).toBe(404)
      })

      it("returns the device's products with notes", async () => {
        const { data } = await api.get(`/admin/devices/${device["iphone-16"].id}`, admin)
        expect(data.device.products).toEqual([
          { id: productIdByHandle["clear-shockproof-case"], title: "Clear Shockproof Case", thumbnail: null, note: "Slim fit" },
        ])
      })
    })

    describe("product links", () => {
      const caseId = () => productIdByHandle["clear-shockproof-case"]

      it("lists a product's devices in display order with notes", async () => {
        const { data } = await api.get(`/admin/products/${caseId()}/devices`, admin)
        expect(data.devices.map((d: any) => [d.slug, d.note])).toEqual([
          ["iphone-16", "Slim fit"],
          ["iphone-16-pro", null],
        ])
      })

      it("re-notes an existing link and unlinks another in one call", async () => {
        const { data } = await api.post(
          `/admin/products/${caseId()}/devices`,
          { add: [{ device_id: device["iphone-16"].id, note: null }], remove: [device["iphone-16-pro"].id] },
          admin
        )
        expect(data.devices.map((d: any) => [d.slug, d.note])).toEqual([["iphone-16", null]])
      })

      it("returns 404 for an unknown device or product", async () => {
        const badDevice = await api
          .post(`/admin/products/${caseId()}/devices`, { add: [{ device_id: "dev_missing" }] }, admin)
          .catch((e: any) => e.response)
        expect(badDevice.status).toBe(404)

        const badProduct = await api
          .get("/admin/products/prod_missing/devices", admin)
          .catch((e: any) => e.response)
        expect(badProduct.status).toBe(404)
      })

      it("restores links and notes when the workflow fails after changing them", async () => {
        const before = await api.get(`/admin/products/${caseId()}/devices`, admin)

        const workflow = setProductDevicesWorkflow(getContainer())
        workflow.appendAction("fail-after-links", "replace-device-links", {
          invoke: async () => {
            throw new Error("boom")
          },
        })
        const { errors } = await workflow.run({
          input: {
            product_id: caseId(),
            add: [{ device_id: device["iphone-11"].id, note: "new" }],
            remove: [device["iphone-16"].id, device["iphone-16-pro"].id],
          },
          throwOnError: false,
        })
        expect(errors).toHaveLength(1)

        const after = await api.get(`/admin/products/${caseId()}/devices`, admin)
        expect(after.data.devices).toEqual(before.data.devices)
      })
    })

    describe("store routes", () => {
      it("groups devices brand -> series and searches aliases", async () => {
        const { data } = await api.get("/store/devices", store)
        expect(data.count).toBe(4)
        expect(data.brands.map((b: any) => b.brand)).toEqual(["Apple", "Sony"])
        expect(data.brands[0].series.map((s: any) => s.series)).toEqual(["iPhone 16", "iPhone 11"])
        expect(data.brands[0].series[0].devices.map((d: any) => d.model)).toEqual(["iPhone 16", "iPhone 16 Pro"])

        const alias = await api.get("/store/devices?q=playstation%205", store)
        expect(alias.data.brands[0].series[0].devices[0].slug).toBe("ps5")

        const phones = await api.get("/store/devices?type=phone", store)
        expect(phones.data.count).toBe(3)

        const none = await api.get("/store/devices?q=nokia", store)
        expect(none.data).toEqual({ brands: [], count: 0 })
      })

      it("retrieves a device by slug with its product count", async () => {
        const { data } = await api.get("/store/devices/iphone-16", store)
        expect(data.device.slug).toBe("iphone-16")
        expect(data.product_count).toBe(1)

        const err = await api.get("/store/devices/iphone-99", store).catch((e: any) => e.response)
        expect(err.status).toBe(404)
      })

      it("lists a device's products in the /store/products shape with prices and notes", async () => {
        const caseId = productIdByHandle["clear-shockproof-case"]
        const { data } = await api.get(
          `/store/devices/iphone-16/products?region_id=${regionId}&fields=*variants.calculated_price`,
          store
        )
        expect(data.count).toBe(1)
        expect(data.limit).toBe(24)
        expect(data.products[0].handle).toBe("clear-shockproof-case")
        expect(data.products[0].variants[0].calculated_price.currency_code).toBe("gbp")
        expect(data.notes).toEqual({ [caseId]: "Slim fit" })

        const core = await api.get(
          `/store/products?id=${caseId}&region_id=${regionId}&fields=*variants.calculated_price`,
          store
        )
        expect(Object.keys(data.products[0]).sort()).toEqual(Object.keys(core.data.products[0]).sort())
      })

      it("returns an empty page for a device with no products, filters categories, 404s unknown", async () => {
        const empty = await api.get("/store/devices/iphone-11/products", store)
        expect(empty.data).toMatchObject({ products: [], count: 0, notes: {} })

        const withCategory = await api.get("/store/devices/ps5/products?category_id=pcat_none", store)
        expect(withCategory.data.count).toBe(0)

        const err = await api.get("/store/devices/iphone-99/products", store).catch((e: any) => e.response)
        expect(err.status).toBe(404)
      })

      it("lists a product's devices for the product page", async () => {
        const { data } = await api.get(
          `/store/products/${productIdByHandle["wireless-controller-ps4"]}/devices`,
          store
        )
        expect(data.devices.map((d: any) => [d.slug, d.note])).toEqual([["ps5", null]])

        const err = await api.get("/store/products/prod_missing/devices", store).catch((e: any) => e.response)
        expect(err.status).toBe(404)
      })
    })

    describe("delete", () => {
      it("deletes a device and its product links, freeing the slug", async () => {
        const { data } = await api.delete(`/admin/devices/${device["ps5"].id}`, admin)
        expect(data).toEqual({ id: device["ps5"].id, object: "device", deleted: true })

        const controller = productIdByHandle["wireless-controller-ps4"]
        const devices = await api.get(`/admin/products/${controller}/devices`, admin)
        expect(devices.data.devices).toEqual([])

        const again = await api.delete(`/admin/devices/${device["ps5"].id}`, admin).catch((e: any) => e.response)
        expect(again.status).toBe(404)

        const recreated = await api.post(
          "/admin/devices",
          newDevice({ brand: "Sony", series: "PlayStation", model: "PS5", type: "console" }),
          admin
        )
        expect(recreated.data.device.slug).toBe("ps5")
      })
    })
  },
})
