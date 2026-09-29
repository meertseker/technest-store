import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createCustomersWorkflow } from "@medusajs/medusa/core-flows"
import customerWelcome from "../../src/subscribers/customer-welcome"
import passwordResetEmail from "../../src/subscribers/password-reset-email"

jest.setTimeout(300 * 1000)

const RUN = Date.now()
const MAILPIT_API = process.env.MAILPIT_API_URL || "http://localhost:8025/api/v1"
process.env.STOREFRONT_URL = "https://technest.co.uk"
process.env.MEDUSA_BACKEND_URL = "https://admin.technest.co.uk"

async function mailTo(to: string, expected: number) {
  let messages: { Subject: string; ID: string }[] = []
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:"${to}"`)}`)
    messages = ((await res.json()) as { messages: { Subject: string; ID: string }[] }).messages ?? []
    if (messages.length >= expected) break
    await new Promise((r) => setTimeout(r, 250))
  }
  return messages
}

async function textOf(id: string) {
  const res = await fetch(`${MAILPIT_API}/message/${id}`)
  return ((await res.json()) as { Text: string }).Text
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    describe("account emails", () => {
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

      it("emails a customer reset link to the storefront and never stores the token", async () => {
        const email = `e2-reset-${RUN}@example.com`
        const token = `tok.${RUN}.signature`

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
      })

      it("sends staff to the admin reset page", async () => {
        const email = `e2-staff-${RUN}@example.com`
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
