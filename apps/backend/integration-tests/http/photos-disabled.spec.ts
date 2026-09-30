import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { adminHeaders } from "../helpers/auth"
import { makePhoto } from "../helpers/photo"

jest.setTimeout(10 * 60 * 1000)

// No worker configured: the app must boot and the photo routes must explain why they're off.
// (An existing empty variable is never overridden by .env files.)
process.env.PHOTO_WORKER_URL = ""

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: { headers: Record<string, string> }

    beforeAll(async () => {
      admin = await adminHeaders(api, getContainer())
    })

    it("GET /admin/photos/status reports disabled with a reason", async () => {
      const { data } = await api.get("/admin/photos/status", admin)
      expect(data).toEqual({
        enabled: false,
        reason: "Photo processing is switched off (PHOTO_WORKER_URL is not set).",
        provider: "disabled",
        default_model: null,
      })
    })

    it("POST /admin/photos/process is refused as not_allowed", async () => {
      const form = new FormData()
      form.append("file", new Blob([new Uint8Array(await makePhoto(1600, 1200))], { type: "image/jpeg" }), "a.jpg")
      const res = await api.post("/admin/photos/process", form, admin).catch((e: any) => e.response)
      expect(res.status).toBe(400)
      expect(res.data).toEqual({
        type: "not_allowed",
        message: "Photo processing is switched off (PHOTO_WORKER_URL is not set).",
      })
    })
  },
})
