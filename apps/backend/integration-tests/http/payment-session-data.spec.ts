import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ApiKeyType, Modules } from "@medusajs/framework/utils"

jest.setTimeout(300 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    describe("POST /store/payment-collections/:id/payment-sessions", () => {
      let headers: Record<string, string>

      beforeAll(async () => {
        const apiKeyModule = getContainer().resolve(Modules.API_KEY)
        const key = await apiKeyModule.createApiKeys({
          title: "test",
          type: ApiKeyType.PUBLISHABLE,
          created_by: "test",
        })
        headers = { "x-publishable-api-key": key.token }
      })

      it("rejects client-supplied session data before it reaches the provider", async () => {
        const res = await api
          .post(
            "/store/payment-collections/pay_col_does_not_matter/payment-sessions",
            { provider_id: "pp_stripe_stripe", data: { id: "pi_someone_else" } },
            { headers }
          )
          .catch((e: any) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("do not send `data`")
      })
    })
  },
})
