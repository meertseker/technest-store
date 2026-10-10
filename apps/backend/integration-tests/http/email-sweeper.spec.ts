import http from "node:http"
import type { AddressInfo } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { mailTo, settle } from "../utils/mailpit"
import { warmDb } from "../utils/warm-db"
import emailSweeperJob from "../../src/jobs/email-sweeper"
import workerHeartbeatJob from "../../src/jobs/worker-heartbeat"
import { setAlertSinkForTests, type Alert } from "../../src/lib/alerting"
import { deliverEmail, type SendEmailInput } from "../../src/lib/email/deliver"
import { resetSmtpCheckForTests } from "../../src/lib/email/smtp-check"
import {
  forgetSweepAttemptsForTests,
  sweepFailedEmails,
  SWEEP_GIVE_UP_AFTER_MS,
  type SweepDeps,
} from "../../src/lib/email/sweeper"
import { REPAIR_MODULE } from "../../src/modules/repair"

jest.setTimeout(300 * 1000)

const MIN = 60_000
const RUN = Date.now()
let n = 0

/**
 * The real Notification module, database and SMTP provider (Mailpit). The mail
 * server "going down" is the provider's send rejecting the way a refused
 * connection does. Emails are sent by one direct attempt rather than through
 * the workflow, whose 60 s retries would outlive the test.
 */
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    describe("failed emails", () => {
      let alerts: Alert[]
      let lines: string[]
      let down: jest.SpyInstance | null

      const notifications = () => getContainer().resolve(Modules.NOTIFICATION) as any

      const deps = (): SweepDeps => ({
        notifications: notifications(),
        deliver: (input) => deliverEmail(getContainer(), input),
        logger: { info: (m: string) => lines.push(m), error: (m: string) => lines.push(m) } as any,
      })

      const smtpDown = () => {
        down = jest
          .spyOn(notifications().notificationProviderService_, "send")
          .mockRejectedValue(new Error("smtp: send failed template=shop-repair-booking code=ECONNECTION response_code=- command=CONN"))
      }
      const smtpUp = () => {
        down?.mockRestore()
        down = null
      }

      /** A repair request and the shop alert for it, addressed to a mailbox only this test uses. */
      async function repairAlert(): Promise<{ shop: string; input: SendEmailInput }> {
        const shop = `e2-sweep-${RUN}-${++n}@example.com`
        process.env.SHOP_NOTIFY_EMAIL = shop
        const [booking] = await (getContainer().resolve(REPAIR_MODULE) as any).createRepairBookings([
          {
            name: "Jo Customer",
            phone: "07700 900123",
            email: "jo.customer@example.com",
            device: "iPhone 14",
            fault: "Cracked screen",
            preferred_time: "Tuesday morning",
          },
        ])
        return {
          shop,
          input: {
            template: "shop-repair-booking",
            recipient: "shop",
            resource_id: booking.id,
            resource_type: "repair_booking",
            trigger_type: "technest.repair_booking.created",
          },
        }
      }

      const original = process.env.SHOP_NOTIFY_EMAIL
      beforeEach(async () => {
        await warmDb(getContainer())
        alerts = []
        lines = []
        down = null
        setAlertSinkForTests((a) => alerts.push(a))
        forgetSweepAttemptsForTests()
        resetSmtpCheckForTests()
      })
      afterEach(() => {
        smtpUp()
        setAlertSinkForTests(undefined)
        process.env.SHOP_NOTIFY_EMAIL = original
      })

      it("an email that failed is stored without personal data, alerted on while it keeps failing, and arrives once the mail server is back", async () => {
        const { shop, input } = await repairAlert()
        const started = Date.now()

        smtpDown()
        await expect(deliverEmail(getContainer(), input)).rejects.toThrow("smtp: send failed")

        const stored = await notifications().listNotifications({ to: shop })
        expect(stored).toHaveLength(1)
        expect(stored[0].status).toBe("failure")
        // Enough to build the email again; none of the name, phone, address or fault it showed.
        expect(stored[0].data).toEqual({ recipient: "shop" })
        expect(JSON.stringify(stored[0])).not.toMatch(/Jo Customer|07700|jo\.customer|Cracked/)

        // Too soon: the send's own retries come first.
        expect(await sweepFailedEmails(deps(), new Date(started + 5 * MIN))).toMatchObject({ sent: 0, failed: 0, waiting: 1 })
        expect(alerts).toEqual([])

        // Still down 15 minutes later: tried again, and a person is told.
        expect(await sweepFailedEmails(deps(), new Date(started + 15 * MIN))).toMatchObject({ sent: 0, failed: 1, gave_up: 0 })
        expect(alerts).toHaveLength(1)
        expect(alerts[0].message).toMatch(/1 email is failing to send/)
        expect(JSON.stringify(alerts) + lines.join("\n")).not.toContain(shop)
        expect(await settle(shop, 500)).toHaveLength(0)

        // The mail server is back: the next due run delivers it, once.
        smtpUp()
        alerts.length = 0
        expect(await sweepFailedEmails(deps(), new Date(started + 60 * MIN))).toMatchObject({ sent: 1, failed: 0 })
        const [mail] = await mailTo(shop, 1)
        expect(mail.Subject).toMatch(/repair/i)
        expect(alerts).toEqual([])

        // Later runs have nothing left to do.
        expect(await sweepFailedEmails(deps(), new Date(started + 5 * 60 * MIN))).toMatchObject({ sent: 0, failed: 0, waiting: 0 })
        expect(await settle(shop, 1000)).toHaveLength(1)
      })

      it("gives an email up after a day, says which one, and says it once", async () => {
        const { shop, input } = await repairAlert()
        const started = Date.now()
        smtpDown()
        await expect(deliverEmail(getContainer(), input)).rejects.toThrow("smtp: send failed")

        const result = await sweepFailedEmails(deps(), new Date(started + SWEEP_GIVE_UP_AFTER_MS + MIN))
        expect(result).toMatchObject({ failed: 1, gave_up: 1 })
        const gaveUp = alerts.filter((a) => /giving up/.test(a.message ?? ""))
        expect(gaveUp).toHaveLength(1)
        expect(gaveUp[0].tags).toMatchObject({
          template: "shop-repair-booking",
          resource_type: "repair_booking",
          resource_id: input.resource_id,
          audience: "shop",
        })
        expect(JSON.stringify(alerts)).not.toContain(shop)

        alerts.length = 0
        const later = await sweepFailedEmails(deps(), new Date(started + SWEEP_GIVE_UP_AFTER_MS + 6 * 60 * MIN))
        expect(later).toMatchObject({ failed: 0, gave_up: 0 })
        expect(alerts).toEqual([])
        expect(await settle(shop, 500)).toHaveLength(0)
      })

      it("the scheduled job runs against the real app: it checks the mail server's login and leaves fresh failures alone", async () => {
        const { shop, input } = await repairAlert()
        smtpDown()
        await expect(deliverEmail(getContainer(), input)).rejects.toThrow("smtp: send failed")
        smtpUp()

        const logger = getContainer().resolve("logger") as any
        const info = jest.spyOn(logger, "info")
        const error = jest.spyOn(logger, "error")
        try {
          await emailSweeperJob(getContainer())
          expect(info.mock.calls.flat().join("\n")).toContain("smtp: connection and login verified")
          expect(error).not.toHaveBeenCalled()
        } finally {
          info.mockRestore()
          error.mockRestore()
        }
        expect(alerts).toEqual([])
        expect(await settle(shop, 500)).toHaveLength(0)
      })
    })

    describe("worker heartbeat", () => {
      const original = process.env.WORKER_HEARTBEAT_URL
      afterEach(() => {
        if (original === undefined) delete process.env.WORKER_HEARTBEAT_URL
        else process.env.WORKER_HEARTBEAT_URL = original
      })

      it("pings the monitor only through the event queue: job, event bus, subscriber", async () => {
        await warmDb(getContainer())
        const hits: string[] = []
        const server = http.createServer((req, res) => {
          hits.push(`${req.method} ${req.url}`)
          res.end("OK")
        })
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
        const port = (server.address() as AddressInfo).port
        try {
          // Unset: nothing is emitted, nothing is requested.
          delete process.env.WORKER_HEARTBEAT_URL
          await workerHeartbeatJob(getContainer())
          await new Promise((r) => setTimeout(r, 1000))
          expect(hits).toEqual([])

          process.env.WORKER_HEARTBEAT_URL = `http://127.0.0.1:${port}/ping/check-id`
          await workerHeartbeatJob(getContainer())
          for (let i = 0; i < 40 && !hits.length; i++) await new Promise((r) => setTimeout(r, 250))
          expect(hits).toEqual(["GET /ping/check-id"])
        } finally {
          server.closeAllConnections()
          await new Promise((resolve) => server.close(resolve))
        }
      })
    })
  },
})
