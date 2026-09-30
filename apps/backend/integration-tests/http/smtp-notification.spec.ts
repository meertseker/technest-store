import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { mailTo } from "../utils/mailpit"

jest.setTimeout(240 * 1000)

// Real SMTP round trip through the shared Mailpit (../utils/mailpit); found by a unique recipient.

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

        const messages = await mailTo(to, 1)
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
