import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { warmDb } from "../utils/warm-db"
import { Modules } from "@medusajs/framework/utils"
import { createCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { mailTo, textOf } from "../utils/mailpit"
import customerWelcome from "../../src/subscribers/customer-welcome"
import passwordResetEmail from "../../src/subscribers/password-reset-email"

jest.setTimeout(300 * 1000)

const RUN = Date.now()
process.env.STOREFRONT_URL = "https://technest.co.uk"
process.env.MEDUSA_BACKEND_URL = "https://admin.technest.co.uk"

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    describe("account emails", () => {
      beforeEach(() => warmDb(getContainer()))

      it("welcomes a customer who registered", async () => {
        const email = `e2-welcome-${RUN}@example.com`
        const {
          result: [customer],
        } = await createCustomersWorkflow(getContainer()).run({
          input: { customersData: [{ email, first_name: "Sam", has_account: true }] },
        })

        await customerWelcome({ event: { name: "customer.created", data: { id: customer.id } }, container: getContainer() } as any)

        const [mail] = await mailTo(email, 1)
        expect(mail.Subject).toBe("Welcome to Tech Nest")
      })

      it("does not welcome a guest checkout customer", async () => {
        const email = `e2-guest-${RUN}@example.com`
        const {
          result: [customer],
        } = await createCustomersWorkflow(getContainer()).run({
          input: { customersData: [{ email, has_account: false }] },
        })

        await customerWelcome({ event: { name: "customer.created", data: { id: customer.id } }, container: getContainer() } as any)

        await new Promise((r) => setTimeout(r, 2000))
        expect(await mailTo(email, 1)).toHaveLength(0)
      })

      async function identity(email: string, app_metadata: Record<string, unknown>) {
        await getContainer()
          .resolve(Modules.AUTH)
          .createAuthIdentities({ provider_identities: [{ provider: "emailpass", entity_id: email }], app_metadata })
      }

      it("emails a customer reset link to the storefront and never stores the token", async () => {
        const email = `e2-reset-${RUN}@example.com`
        const token = `tok.${RUN}.signature`
        await identity(email, { customer_id: "cus_test" })

        await passwordResetEmail({
          event: { name: "auth.password_reset", data: { entity_id: email, actor_type: "customer", token } },
          container: getContainer(),
        } as any)

        const [mail] = await mailTo(email, 1)
        expect(mail.Subject).toBe("Reset your Tech Nest password")
        const text = await textOf(mail.ID)
        expect(text).toContain(
          `https://technest.co.uk/account/reset-password?token=${token}&email=${encodeURIComponent(email)}`
        )

        const stored = await getContainer()
          .resolve(Modules.NOTIFICATION)
          .listNotifications({ to: email, template: "password-reset" })
        expect(stored).toHaveLength(1)
        expect(JSON.stringify(stored[0])).not.toContain(token)

        // Nor in any stored workflow execution (they persist inputs).
        const executions = await getContainer().resolve(Modules.WORKFLOW_ENGINE).listWorkflowExecutions({})
        expect(JSON.stringify(executions)).not.toContain(token)
      })

      it("sends nothing when the login isn't a customer account", async () => {
        const email = `e2-notcustomer-${RUN}@example.com`
        await identity(email, { user_id: "user_test" })

        await passwordResetEmail({
          event: { name: "auth.password_reset", data: { entity_id: email, actor_type: "customer", token: "t.x" } },
          container: getContainer(),
        } as any)

        await new Promise((r) => setTimeout(r, 2000))
        expect(await mailTo(email, 1)).toHaveLength(0)
      })

      it("sends nothing for unknown actor types", async () => {
        const email = `e2-vendor-${RUN}@example.com`
        await identity(email, { vendor_id: "v_1", customer_id: "cus_1" })

        await passwordResetEmail({
          event: { name: "auth.password_reset", data: { entity_id: email, actor_type: "vendor", token: "t.v" } },
          container: getContainer(),
        } as any)

        await new Promise((r) => setTimeout(r, 2000))
        expect(await mailTo(email, 1)).toHaveLength(0)
      })

      it("sends staff to the admin reset page", async () => {
        const email = `e2-staff-${RUN}@example.com`
        await identity(email, { user_id: "user_staff" })
        await passwordResetEmail({
          event: { name: "auth.password_reset", data: { entity_id: email, actor_type: "user", token: "t.staff" } },
          container: getContainer(),
        } as any)

        const [mail] = await mailTo(email, 1)
        expect(mail.Subject).toBe("Reset your Tech Nest admin password")
        expect(await textOf(mail.ID)).toContain("https://admin.technest.co.uk/app/reset-password?token=t.staff")
      })
    })
  },
})
