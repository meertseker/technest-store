import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import fs from "fs"
import path from "path"
import sharp from "sharp"
import { adminHeaders } from "../helpers/auth"
import { makePhoto, MockWorker, PRODUCT_COLOUR, startMockWorker } from "../helpers/photo"

jest.setTimeout(10 * 60 * 1000)

// The module reads PHOTO_WORKER_URL when the app boots, so pick the mock
// worker's port up front.
const WORKER_PORT = 45000 + Math.floor(Math.random() * 5000)
process.env.PHOTO_WORKER_URL = `http://127.0.0.1:${WORKER_PORT}`

// Local file provider writes here (relative to apps/backend).
const STATIC_DIR = path.resolve(process.cwd(), "static")
const listStatic = () => (fs.existsSync(STATIC_DIR) ? fs.readdirSync(STATIC_DIR).sort() : [])

type Headers = { headers: Record<string, string> }

function multipart(photo: Buffer, fields: Record<string, string> = {}, type = "image/jpeg", name = "IMG_0042.jpg") {
  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(photo)], { type }), name)
  for (const [k, v] of Object.entries(fields)) {
    form.append(k, v)
  }
  return form
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    let worker: MockWorker
    let photo: Buffer
    let staticBefore: string[]
    let productId: string
    let processed: { original: any; processed: any; processed_avif: any }

    beforeAll(async () => {
      worker = await startMockWorker(WORKER_PORT)
      staticBefore = listStatic()
      admin = await adminHeaders(api, getContainer())
      // Product 1920 px wide: large enough to be downscaled into the full 2000 px canvas.
      photo = await makePhoto(4800, 3600)

      // Everything the DB needs is created here: the runner snapshots the DB
      // after beforeAll and restores it before every test.
      const { result } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title: "Photo test case",
              handle: `photo-test-${Date.now()}`,
              thumbnail: "https://example.com/old.jpg",
              images: [{ url: "https://example.com/old.jpg" }],
              metadata: { supplier_sku: "ABC-1" },
              options: [{ title: "Default", values: ["Default"] }],
              variants: [{ title: "Default", options: { Default: "Default" }, prices: [] }],
            },
          ],
        },
      })
      productId = result[0].id
      const { data } = await api.post("/admin/photos/process", multipart(photo), admin)
      processed = data
    })

    beforeEach(() => {
      worker.requests.length = 0
      worker.failWith = null
    })

    afterAll(async () => {
      await worker?.close()
      // Remove files the tests uploaded; leave anything that was there before.
      for (const f of listStatic()) {
        if (!staticBefore.includes(f)) {
          fs.rmSync(path.join(STATIC_DIR, f), { force: true })
        }
      }
    })

    const newFiles = (before: string[]) => listStatic().filter((f) => !before.includes(f))

    describe("GET /admin/photos/status", () => {
      it("is enabled when the worker answers /health", async () => {
        const { data } = await api.get("/admin/photos/status", admin)
        expect(data).toEqual({
          enabled: true,
          reason: null,
          provider: "rembg-http",
          default_model: "birefnet-general",
        })
      })

      it("needs an admin", async () => {
        const res = await api.get("/admin/photos/status").catch((e: any) => e.response)
        expect(res.status).toBe(401)
      })
    })

    describe("POST /admin/photos/process", () => {
      it("stores the original untouched and returns a separate 2000x2000 WebP and AVIF on white", async () => {
        const { status, data } = await api.post("/admin/photos/process", multipart(photo), admin)
        expect(status).toBe(200)
        expect(data).toEqual({
          original: { id: expect.any(String), url: expect.stringContaining("IMG_0042") },
          processed: {
            id: expect.stringMatching(/\.webp$/),
            url: expect.stringMatching(/\.webp$/),
            format: "webp",
            width: 2000,
            height: 2000,
          },
          processed_avif: {
            id: expect.stringMatching(/\.avif$/),
            url: expect.stringMatching(/\.avif$/),
            format: "avif",
            width: 2000,
            height: 2000,
          },
          model: "birefnet-general",
          timings_ms: {
            remove_background: expect.any(Number),
            render: expect.any(Number),
            total: expect.any(Number),
          },
        })

        // The model is always named explicitly.
        expect(worker.requests).toEqual([{ model: "birefnet-general", bytes: expect.any(Number) }])

        const fileModule = getContainer().resolve(Modules.FILE)
        const original = await fileModule.getAsBuffer(data.original.id)
        expect(original.equals(photo)).toBe(true)
        expect(new Set([data.original.id, data.processed.id, data.processed_avif.id]).size).toBe(3)

        const processed = await fileModule.getAsBuffer(data.processed.id)
        const meta = await sharp(processed).metadata()
        expect(meta).toMatchObject({ format: "webp", width: 2000, height: 2000 })
        const { data: px } = await sharp(processed).raw().toBuffer({ resolveWithObject: true })
        expect(Math.min(px[0], px[1], px[2])).toBeGreaterThanOrEqual(254) // top-left corner is white
        const centre = (1000 * 2000 + 1000) * 3
        // The product's colour is the original's (only the background changed).
        expect(Math.abs(px[centre] - PRODUCT_COLOUR.r)).toBeLessThanOrEqual(4)
        expect(Math.abs(px[centre + 1] - PRODUCT_COLOUR.g)).toBeLessThanOrEqual(4)
        expect(Math.abs(px[centre + 2] - PRODUCT_COLOUR.b)).toBeLessThanOrEqual(4)

        const avif = await fileModule.getAsBuffer(data.processed_avif.id)
        expect(await sharp(avif).metadata()).toMatchObject({ width: 2000, height: 2000 })
      })

      it("passes the fallback model through", async () => {
        const { data } = await api.post(
          "/admin/photos/process",
          multipart(photo, { model: "isnet-general-use" }),
          admin
        )
        expect(data.model).toBe("isnet-general-use")
        expect(worker.requests[0].model).toBe("isnet-general-use")
      })

      it("accepts a file_id from /admin/uploads and uses that file as the original", async () => {
        const form = new FormData()
        form.append("files", new Blob([new Uint8Array(photo)], { type: "image/jpeg" }), "counter.jpg")
        const { data: uploaded } = await api.post("/admin/uploads", form, admin)
        const fileId = uploaded.files[0].id

        const { status, data } = await api.post("/admin/photos/process", { file_id: fileId }, admin)
        expect(status).toBe(200)
        expect(data.original).toEqual({ id: fileId, url: uploaded.files[0].url })
        expect(data.processed.format).toBe("webp")
      })

      it("rejects a photo whose shorter side is under 1000px and keeps nothing", async () => {
        const before = listStatic()
        const small = await makePhoto(1400, 999)
        const res = await api.post("/admin/photos/process", multipart(small), admin).catch((e: any) => e.response)
        expect(res.status).toBe(400)
        expect(res.data).toEqual({ type: "invalid_data", message: "Photo too small, please retake closer" })
        expect(worker.requests).toHaveLength(0)
        // Compensation removed the original this request uploaded.
        expect(newFiles(before)).toEqual([])
      })

      it("does not delete a caller's file_id upload when processing fails", async () => {
        const form = new FormData()
        form.append("files", new Blob([new Uint8Array(await makePhoto(1200, 800))], { type: "image/jpeg" }), "small.jpg")
        const { data: uploaded } = await api.post("/admin/uploads", form, admin)
        const fileId = uploaded.files[0].id

        const res = await api
          .post("/admin/photos/process", { file_id: fileId }, admin)
          .catch((e: any) => e.response)
        expect(res.status).toBe(400)
        const kept = await getContainer().resolve(Modules.FILE).getAsBuffer(fileId)
        expect(kept.length).toBeGreaterThan(0)
      })

      it("reports a worker failure and rolls back the stored original", async () => {
        const before = listStatic()
        worker.failWith = 500
        const res = await api.post("/admin/photos/process", multipart(photo), admin).catch((e: any) => e.response)
        expect(res.status).toBe(500)
        expect(worker.requests).toHaveLength(1)
        expect(newFiles(before)).toEqual([])
      })

      it("validates the request", async () => {
        const call = (body: unknown) =>
          api.post("/admin/photos/process", body, admin).catch((e: any) => e.response)

        const neither = await call({})
        expect(neither.status).toBe(400)
        expect(neither.data.message).toMatch(/either a photo/)

        const unknownKey = await call({ file_id: "x", colour: "red" })
        expect(unknownKey.status).toBe(400)

        const badModel = await call({ file_id: "x", model: "u2net" })
        expect(badModel.status).toBe(400)

        const both = new FormData()
        both.append("file", new Blob([new Uint8Array(photo)], { type: "image/jpeg" }), "a.jpg")
        both.append("file_id", "abc")
        expect((await call(both)).status).toBe(400)

        const gif = await call(multipart(Buffer.from("GIF89a"), {}, "image/gif", "a.gif"))
        expect(gif.status).toBe(400)
        expect(gif.data.message).toMatch(/not a supported image/)

        const notImage = await call(multipart(Buffer.from("hello"), {}, "image/jpeg", "a.jpg"))
        expect(notImage.status).toBe(400)
        expect(notImage.data.message).toMatch(/not a supported image/)

        const traversal = await call({ file_id: "../../medusa-config.ts" })
        expect(traversal.status).toBe(400)
        expect(traversal.data.message).toMatch(/Invalid file id/)

        const unknownFile = await call({ file_id: "does-not-exist.jpg" })
        expect(unknownFile.status).toBe(400)
        expect(unknownFile.data.message).toMatch(/Unknown file_id/)
      })

      it("needs an admin", async () => {
        const res = await api.post("/admin/photos/process", multipart(photo)).catch((e: any) => e.response)
        expect(res.status).toBe(401)
        expect(worker.requests).toHaveLength(0)
      })
    })

    describe("POST /admin/products/:id/photos/approve", () => {
      it("sets the processed image as thumbnail and first image, keeping the original and old images", async () => {
        const body = {
          processed_file_id: processed.processed.id,
          original_file_id: processed.original.id,
          processed_avif_file_id: processed.processed_avif.id,
        }
        const { status, data } = await api.post(`/admin/products/${productId}/photos/approve`, body, admin)
        expect(status).toBe(200)
        expect(data.product).toEqual({
          id: productId,
          thumbnail: processed.processed.url,
          images: [
            { id: expect.any(String), url: processed.processed.url },
            { id: expect.any(String), url: "https://example.com/old.jpg" },
          ],
          metadata: {
            supplier_sku: "ABC-1",
            photo_originals: [
              {
                processed_file_id: processed.processed.id,
                processed_url: processed.processed.url,
                processed_avif_url: processed.processed_avif.url,
                original_file_id: processed.original.id,
                original_url: processed.original.url,
              },
            ],
          },
        })

        // The original file is still there.
        const original = await getContainer().resolve(Modules.FILE).getAsBuffer(processed.original.id)
        expect(original.equals(photo)).toBe(true)

        // Approving again doesn't duplicate the image or the record.
        const { data: again } = await api.post(`/admin/products/${productId}/photos/approve`, body, admin)
        expect(again.product.images).toHaveLength(2)
        expect(again.product.metadata.photo_originals).toHaveLength(1)
      })

      it("can leave the thumbnail alone", async () => {
        const { data } = await api.post(
          `/admin/products/${productId}/photos/approve`,
          {
            processed_file_id: processed.processed.id,
            original_file_id: processed.original.id,
            set_thumbnail: false,
          },
          admin
        )
        expect(data.product.thumbnail).toBe("https://example.com/old.jpg")
        expect(data.product.images[0].url).toBe(processed.processed.url)
      })

      it("404s for an unknown product and 400s for unknown files or bad bodies", async () => {
        const body = { processed_file_id: processed.processed.id, original_file_id: processed.original.id }
        const missing = await api
          .post("/admin/products/prod_missing/photos/approve", body, admin)
          .catch((e: any) => e.response)
        expect(missing.status).toBe(404)

        const badFile = await api
          .post(`/admin/products/${productId}/photos/approve`, { ...body, original_file_id: "nope.jpg" }, admin)
          .catch((e: any) => e.response)
        expect(badFile.status).toBe(400)
        expect(badFile.data.message).toMatch(/Unknown file id/)

        const invalid = await api
          .post(`/admin/products/${productId}/photos/approve`, { processed_file_id: "x" }, admin)
          .catch((e: any) => e.response)
        expect(invalid.status).toBe(400)
      })
    })
  },
})
