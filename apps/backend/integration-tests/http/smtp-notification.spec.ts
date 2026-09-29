import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

jest.setTimeout(240 * 1000)

// Real SMTP round trip through the shared dev Mailpit (SMTP 1025, API 8025).
// Messages are found by a unique recipient; never delete the shared mailbox.
const MAILPIT_API = process.env.MAILPIT_API_URL || "http://localhost:8025/api/v1"

async function findInMailpit(to: string) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:"${to}"`)}`)
    const body = (await res.json()) as { messages: { ID: string; Subject: string }[] }
    if (body.messages?.length) {
      return body.messages
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return []
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    describe("smtp notification provider", () => {
      it("delivers an email-channel notification to the SMTP server and stores it as sent", async () => {
        const notificationModule = getContainer().resolve(Modules.NOTIFICATION)
        const to = `e2-smtp-${Date.now()}@example.com`

        const [notification] = await notificationModule.createNotifications([
          {
            to,
            channel: "email",
            template: "integration-test",
            content: { subject: "SMTP integration test", html: "<p>ok</p>", text: "ok" },
          },
        ])

        const messages = await findInMailpit(to)
        expect(messages).toHaveLength(1)
        expect(messages[0].Subject).toBe("SMTP integration test")

        const stored = await notificationModule.retrieveNotification(notification.id)
        expect(stored.provider_id).toBe("smtp")
        expect(stored.status).toBe("success")
        expect(stored.external_id).toEqual(expect.any(String))
      })
    })
  },
})
