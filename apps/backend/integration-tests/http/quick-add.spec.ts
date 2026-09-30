import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import fs from "fs"
import path from "path"
import sharp from "sharp"
import { seedTechNest } from "../../src/scripts/seed"
import { resetQuickAddAiLimiter } from "../../src/api/admin/quick-add/middlewares"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../src/modules/product-attributes"
import { AnthropicStub, startAnthropicStub } from "../helpers/anthropic"
import { adminHeaders } from "../helpers/auth"
import { makePhoto, MockWorker, startMockWorker } from "../helpers/photo"

jest.setTimeout(10 * 60 * 1000)

// Everything the app reads at boot is set before the runner starts it.
const STUB_PORT = 40000 + Math.floor(Math.random() * 5000)
const WORKER_PORT = STUB_PORT + 5000
const TEST_KEY = "sk-ant-test-stub-key"
const AI_LIMIT = 4
process.env.ANTHROPIC_API_KEY = TEST_KEY
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${STUB_PORT}`
process.env.QUICK_ADD_AI_TIMEOUT_MS = "800"
process.env.QUICK_ADD_AI_LIMIT_PER_HOUR = String(AI_LIMIT)
process.env.PHOTO_WORKER_URL = `http://127.0.0.1:${WORKER_PORT}`

const STATIC_DIR = path.resolve(process.cwd(), "static")
const listStatic = () => (fs.existsSync(STATIC_DIR) ? fs.readdirSync(STATIC_DIR).sort() : [])

type Headers = { headers: Record<string, string> }

const ANSWER = {
  is_product_photo: true,
  title: "Anker 20W USB-C Wall Charger",
  description: "Compact 20W USB-C wall charger with a UK plug.",
  category_handle: "chargers-cables",
  product_type: "charger",
  compatible_device_slugs: ["iphone-16", "not-a-device"],
  safety_marking: "UKCA",
  safety_marking_evidence: "UKCA mark printed on the side of the box",
  connector_a: "USB-C",
  connector_b: null,
  wattage: 20,
  cable_length_m: null,
  suggested_price_gbp: 14.99,
  looks_like_vape: false,
  confidence: "high",
  notes: "Check the plug type.",
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    let stub: AnthropicStub
    let worker: MockWorker
    let staticBefore: string[]
    let photoFileId: string
    let chargersId: string
    let casesId: string
    let deviceId: string
    let locationId: string

    const upload = async (buffer: Buffer, name = "IMG_0001.jpg", type = "image/jpeg") => {
      const form = new FormData()
      form.append("files", new Blob([new Uint8Array(buffer)], { type }), name)
      const { data } = await api.post("/admin/uploads", form, admin)
      return data.files[0] as { id: string; url: string }
    }
    const analyze = (body: unknown, headers: Headers = admin) =>
      api.post("/admin/quick-add/analyze", body, headers).catch((e: any) => e.response)
    const create = (body: unknown, headers: Headers = admin) =>
      api.post("/admin/quick-add", body, headers).catch((e: any) => e.response)
    const productCount = async () =>
      (await api.get("/admin/products?limit=1", admin)).data.count as number

    const valid = () => ({
      title: "Anker 20W USB-C Wall Charger",
      description: "Compact 20W USB-C wall charger.",
      category_id: chargersId,
      product_type: "charger",
      device_ids: [deviceId],
      price: 12.99,
      sku: "QA-ANKER-20W",
      stock: 5,
      safety_marking: "UKCA",
      safety_marking_confirmed: true,
      attributes: { connector_a: "USB-C", wattage: 20 },
      photo_file_id: photoFileId,
      ai_assisted: true,
    })

    beforeAll(async () => {
      stub = await startAnthropicStub(STUB_PORT)
      stub.answer = ANSWER
      worker = await startMockWorker(WORKER_PORT)
      staticBefore = listStatic()

      const container = getContainer()
      const seeded = await seedTechNest(container)
      locationId = seeded.stockLocation.id
      admin = await adminHeaders(api, container)
      const { data: device } = await api.post(
        "/admin/devices",
        { brand: "Apple", series: "iPhone 16", model: "iPhone 16", type: "phone" },
        admin
      )
      deviceId = device.device.id

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: cats } = await query.graph({
        entity: "product_category",
        fields: ["id", "handle"],
        filters: { handle: ["chargers-cables", "cases"] },
      })
      chargersId = cats.find((c: any) => c.handle === "chargers-cables")!.id
      casesId = cats.find((c: any) => c.handle === "cases")!.id

      photoFileId = (await upload(await makePhoto(1600, 1200))).id
    })

    beforeEach(() => {
      stub.mode = "ok"
      stub.requests.length = 0
      resetQuickAddAiLimiter()
      process.env.ANTHROPIC_API_KEY = TEST_KEY
    })

    afterAll(async () => {
      await stub?.close()
      await worker?.close()
      for (const f of listStatic()) {
        if (!staticBefore.includes(f)) fs.rmSync(path.join(STATIC_DIR, f), { force: true })
      }
    })

    describe("auth", () => {
      it("needs an admin session on every quick-add route", async () => {
        for (const [method, url] of [
          ["get", "/admin/quick-add/status"],
          ["post", "/admin/quick-add/analyze"],
          ["post", "/admin/quick-add"],
        ] as const) {
          const res = await (method === "get" ? api.get(url) : api.post(url, { file_id: photoFileId })).catch(
            (e: any) => e.response
          )
          expect(res.status).toBe(401)
        }
        const bad = await analyze({ file_id: photoFileId }, { headers: { authorization: "Bearer nope" } })
        expect(bad.status).toBe(401)
        expect(stub.requests).toHaveLength(0)
      })
    })

    describe("GET /admin/quick-add/status", () => {
      it("says whether AI is on, without exposing the key", async () => {
        const { data } = await api.get("/admin/quick-add/status", admin)
        expect(data).toEqual({ ai_enabled: true, reason: null, model: "claude-opus-5-5" })

        delete process.env.ANTHROPIC_API_KEY
        const { data: off } = await api.get("/admin/quick-add/status", admin)
        expect(off.ai_enabled).toBe(false)
        expect(off.reason).toMatch(/ANTHROPIC_API_KEY/)
        expect(JSON.stringify(off)).not.toContain(TEST_KEY)
      })
    })

    describe("POST /admin/quick-add/analyze", () => {
      it("returns a draft suggestion mapped onto the catalogue", async () => {
        const res = await analyze({ file_id: photoFileId })
        expect(res.status).toBe(200)
        expect(res.data.suggestion).toMatchObject({
          title: ANSWER.title,
          category: { id: chargersId, handle: "chargers-cables" },
          product_type: "charger",
          devices: [{ id: deviceId, slug: "iphone-16", name: "Apple iPhone 16" }],
          safety_marking: { guess: "UKCA", confirmed: false, required_to_publish: true },
          suggested_price: { amount: 14.99, currency_code: "gbp", is_suggestion: true },
          attributes: { connector_a: "USB-C", wattage: 20 },
        })
        expect(res.data.original.id).toBe(photoFileId)
        expect(res.data.model).toBe("claude-opus-5-5")
        expect(JSON.stringify(res.data)).not.toContain(TEST_KEY)
        // Writes nothing.
        expect(
          (await api.get(`/admin/products?q=${encodeURIComponent(ANSWER.title)}`, admin)).data.count
        ).toBe(0)
      })

      it("sends a downsized photo, the catalogue and structured-output settings to Claude", async () => {
        await analyze({ file_id: photoFileId })
        expect(stub.requests).toHaveLength(1)
        const { headers, body } = stub.requests[0]
        expect(headers["x-api-key"]).toBe(TEST_KEY)
        expect(headers["anthropic-beta"]).toContain("server-side-fallback-2026-07-01")
        expect(body.model).toBe("claude-opus-5-5")
        expect(body.fallbacks).toBe("default")
        expect(body.thinking).toBeUndefined()
        expect(body.output_config.format.type).toBe("json_schema")
        expect(body.output_config.format.schema.additionalProperties).toBe(false)
        expect(body.system[0].text).toContain("- chargers-cables: Chargers & Cables")
        expect(body.system[0].text).toContain("- iphone-16: Apple iPhone 16")
        const image = body.messages[0].content[0]
        expect(image.source.media_type).toBe("image/jpeg")
        const meta = await sharp(Buffer.from(image.source.data, "base64")).metadata()
        expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1568)
      })

      it("validates the body and the file", async () => {
        expect((await analyze({})).status).toBe(400)
        expect((await analyze({ file_id: photoFileId, extra: 1 })).status).toBe(400)
        expect((await analyze({ file_id: "../etc/passwd" })).status).toBe(400)
        const unknown = await analyze({ file_id: "does-not-exist.jpg" })
        expect(unknown.status).toBe(400)
        expect(unknown.data.message).toMatch(/Unknown file_id/)

        const text = await upload(Buffer.from("hello, not an image"), "notes.jpg", "image/jpeg")
        const notImage = await analyze({ file_id: text.id })
        expect(notImage.status).toBe(400)
        expect(notImage.data.message).toMatch(/not a supported image/)
        expect(stub.requests).toHaveLength(0)
      })

      it("answers 503 when no API key is configured, without calling Claude", async () => {
        delete process.env.ANTHROPIC_API_KEY
        const res = await analyze({ file_id: photoFileId })
        expect(res.status).toBe(503)
        expect(res.data.type).toBe("ai_unavailable")
        expect(stub.requests).toHaveLength(0)
      })

      it.each([
        ["refusal", 422, "ai_refused"],
        ["garbage", 502, "ai_bad_response"],
        ["slow", 504, "ai_timeout"],
        ["error500", 503, "ai_unavailable"],
        ["unauthorized", 503, "ai_unavailable"],
      ] as const)("maps a %s answer to %i %s", async (mode, status, type) => {
        stub.mode = mode
        const res = await analyze({ file_id: photoFileId })
        expect(res.status).toBe(status)
        expect(res.data.type).toBe(type)
        expect(JSON.stringify(res.data)).not.toContain(TEST_KEY)
      })

      it("rate-limits per admin user", async () => {
        const other = await adminHeaders(api, getContainer(), "second@technest.test")
        for (let i = 0; i < AI_LIMIT; i++) {
          expect((await analyze({ file_id: photoFileId }, other)).status).toBe(200)
        }
        const limited = await analyze({ file_id: photoFileId }, other)
        expect(limited.status).toBe(429)
        expect(limited.data.type).toBe("too_many_requests")
        expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0)
        expect(stub.requests).toHaveLength(AI_LIMIT)
        // Another user still has their own allowance.
        expect((await analyze({ file_id: photoFileId })).status).toBe(200)
      })
    })

    describe("POST /admin/quick-add", () => {
      it("creates a draft product with price, attributes, devices, stock and the original photo", async () => {
        const res = await create(valid())
        expect(res.status).toBe(201)
        const product = res.data.product
        expect(product).toMatchObject({
          title: "Anker 20W USB-C Wall Charger",
          handle: "anker-20w-usb-c-wall-charger",
          status: "draft",
          type: { value: "charger" },
          categories: [{ id: chargersId }],
          metadata: {
            quick_add: { ai_assisted: true, original_file_id: photoFileId },
          },
          product_attributes: { safety_marking: "UKCA", connector_a: "USB-C", wattage: 20 },
        })
        expect(product.metadata.quick_add.original_url).toMatch(/^http/)
        // Major units, never x100.
        expect(product.variants[0].prices).toEqual([
          expect.objectContaining({ amount: 12.99, currency_code: "gbp" }),
        ])

        const { data: devices } = await api.get(`/admin/products/${product.id}/devices`, admin)
        expect(devices.devices.map((d: any) => d.id)).toEqual([deviceId])

        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data: variants } = await query.graph({
          entity: "product_variant",
          fields: [
            "inventory_items.inventory.location_levels.location_id",
            "inventory_items.inventory.location_levels.stocked_quantity",
          ],
          filters: { sku: "QA-ANKER-20W" },
        })
        expect((variants[0] as any).inventory_items[0].inventory.location_levels).toEqual([
          expect.objectContaining({ location_id: locationId, stocked_quantity: 5 }),
        ])
      })

      it("picks a free handle for a repeated title", async () => {
        const first = await create({ ...valid(), sku: "QA-1" })
        const second = await create({ ...valid(), sku: "QA-2" })
        expect(first.status).toBe(201)
        expect(second.data.product.handle).toBe("anker-20w-usb-c-wall-charger-2")
      })

      it("validates the body", async () => {
        const cases: [Record<string, unknown>, RegExp | null][] = [
          [{ ...valid(), title: "" }, null],
          [{ ...valid(), price: 0 }, null],
          [{ ...valid(), price: 3.499 }, /2 decimals/],
          [{ ...valid(), price: "12.99" }, null],
          [{ ...valid(), status: "published" }, null],
          [{ ...valid(), safety_marking: "FCC" }, null],
          [{ ...valid(), stock: -1 }, null],
          [{ ...valid(), photo_file_id: "/abs/path.jpg" }, null],
        ]
        for (const [body, message] of cases) {
          const res = await create(body)
          expect(res.status).toBe(400)
          if (message) expect(res.data.message).toMatch(message)
        }
      })

      it("needs staff to confirm a claimed safety marking", async () => {
        const res = await create({ ...valid(), safety_marking_confirmed: false })
        expect(res.status).toBe(400)
        expect(res.data.message).toMatch(/I have checked the label/)
        const none = await create({ ...valid(), safety_marking: "none", safety_marking_confirmed: undefined })
        expect(none.status).toBe(201)
      })

      it("refuses vapes, unknown references and a used SKU, writing nothing", async () => {
        const count = await productCount()
        const vape = await create({ ...valid(), title: "Elf Bar 600 Disposable Vape" })
        expect(vape.status).toBe(400)
        expect(vape.data.message).toMatch(/vape/i)
        expect((await create({ ...valid(), category_id: "pcat_nope" })).status).toBe(400)
        expect((await create({ ...valid(), device_ids: ["dev_nope"] })).status).toBe(400)
        expect((await create({ ...valid(), photo_file_id: "missing.jpg" })).status).toBe(400)
        expect(await productCount()).toBe(count)

        expect((await create(valid())).status).toBe(201)
        const dup = await create({ ...valid(), title: "Other" })
        expect(dup.status).toBe(400)
        expect(dup.data.message).toMatch(/already used/)
      })

      it("keeps publishing behind the safety-marking guard", async () => {
        const res = await create({
          ...valid(),
          safety_marking: "none",
          safety_marking_confirmed: undefined,
        })
        expect(res.status).toBe(201)
        const id = res.data.product.id
        expect(res.data.product.status).toBe("draft")

        const publish = await api
          .post(`/admin/products/${id}`, { status: "published" }, admin)
          .catch((e: any) => e.response)
        expect(publish.status).toBe(400)
        expect(publish.data.message).toMatch(/UKCA or CE/)
        const { data } = await api.get(`/admin/products/${id}`, admin)
        expect(data.product.status).toBe("draft")

        // A confirmed marking may be published (an explicit, separate action).
        const marked = await create({ ...valid(), sku: "QA-MARKED", title: "Marked charger" })
        const ok = await api.post(`/admin/products/${marked.data.product.id}`, { status: "published" }, admin)
        expect(ok.data.product.status).toBe("published")
      })

      it("creates non-charger products without a marking", async () => {
        const res = await create({
          ...valid(),
          title: "Clear Case",
          category_id: casesId,
          product_type: "case",
          safety_marking: "none",
          safety_marking_confirmed: undefined,
          attributes: undefined,
          sku: undefined,
        })
        expect(res.status).toBe(201)
        expect(res.data.product.product_attributes.safety_marking).toBe("none")
      })

      it("rolls everything back when a later step fails", async () => {
        const service = getContainer().resolve(PRODUCT_ATTRIBUTES_MODULE) as any
        const spy = jest.spyOn(service, "createProductAttributes").mockRejectedValueOnce(new Error("boom"))
        const count = await productCount()
        try {
          const res = await create({ ...valid(), product_type: "wireless-charger" })
          expect(res.status).toBeGreaterThanOrEqual(400)
        } finally {
          spy.mockRestore()
        }
        expect(await productCount()).toBe(count)
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data: types } = await query.graph({
          entity: "product_type",
          fields: ["id"],
          filters: { value: "wireless-charger" },
        })
        expect(types).toHaveLength(0)
      })

      it("hands the original to the photo pipeline (process -> approve) and keeps it", async () => {
        const { data } = await create(valid())
        const product = data.product
        const original = product.metadata.quick_add.original_file_id

        const { data: processed } = await api.post("/admin/photos/process", { file_id: original }, admin)
        expect(processed.original.id).toBe(original)

        const { data: approved } = await api.post(
          `/admin/products/${product.id}/photos/approve`,
          {
            processed_file_id: processed.processed.id,
            processed_avif_file_id: processed.processed_avif.id,
            original_file_id: original,
          },
          admin
        )
        expect(approved.product.thumbnail).toBe(processed.processed.url)
        expect(approved.product.metadata.quick_add.original_file_id).toBe(original)
        expect(approved.product.metadata.photo_originals[0].original_file_id).toBe(original)
        // Still a draft: approving a photo never publishes.
        const { data: after } = await api.get(`/admin/products/${product.id}`, admin)
        expect(after.product.status).toBe("draft")
      })
    })
  },
})
