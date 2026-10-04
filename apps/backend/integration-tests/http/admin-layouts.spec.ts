// Medusa's admin asks its own Settings module for layouts on every page load. Our shop settings module
// must not register under that module's key ("settings"), or these requests fail with a 500.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { SETTINGS_MODULE } from "../../src/modules/settings"
import { adminHeaders } from "../helpers/auth"

jest.setTimeout(10 * 60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    it("our shop settings module doesn't take the key of Medusa's Settings module", () => {
      expect(SETTINGS_MODULE).not.toBe(Modules.SETTINGS)
    })

    it("GET /admin/layouts/:zone/configuration answers 200 for a signed-in admin", async () => {
      const admin = await adminHeaders(api, getContainer())

      const res = await api.get("/admin/layouts/sidebar/configuration", admin).catch((e: any) => e.response)

      expect({ status: res.status, message: res.data?.message }).toEqual({ status: 200, message: undefined })
      expect(res.data).toHaveProperty("default_configuration")
    })
  },
})
