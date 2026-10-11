import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCustomersWorkflow } from "@medusajs/medusa/core-flows"
import notificationRetentionJob from "../../src/jobs/notification-retention"
import { deliverEmail } from "../../src/lib/email/deliver"
import { mailTo, textOf } from "../utils/mailpit"
import { warmDb } from "../utils/warm-db"

jest.setTimeout(240 * 1000)

const DAY = 24 * 60 * 60 * 1000
const RUN = Date.now()

/**
 * The real Notification module, database and SMTP provider (Mailpit). Rows are
 * aged by rewriting created_at, the way a 100-day-old order confirmation would
 * sit in the table.
 */
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    const notifications = () => getContainer().resolve(Modules.NOTIFICATION) as any
    const db = () => getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION)

    const idsInTable = async (ids: string[]): Promise<string[]> => {
      const { rows } = await db().raw(`select id from notification where id = any(?) order by id`, [ids])
      return rows.map((r: { id: string }) => r.id)
    }

    async function sentRow(label: string) {
      const to = `e2-retention-${label}-${RUN}@example.com`
      const [n] = await notifications().createNotifications([
        { to, channel: "email", template: "integration-test", content: { subject: `retention ${label}`, text: "ok" } },
      ])
      return n.id as string
    }

    const original = process.env.NOTIFICATION_RETENTION_DAYS
    beforeEach(() => warmDb(getContainer()))
    afterEach(() => {
      if (original === undefined) delete process.env.NOTIFICATION_RETENTION_DAYS
      else process.env.NOTIFICATION_RETENTION_DAYS = original
    })

    describe("what an attempt stores", () => {
      it("keeps no name or content in the row, and the email itself still renders in full", async () => {
        const email = `e2-retention-welcome-${RUN}@example.com`
        const {
          result: [customer],
        } = await createCustomersWorkflow(getContainer()).run({
          input: { customersData: [{ email, first_name: "Priya", last_name: "Nair", has_account: true }] },
        })
        // The real customer.created subscriber sends this welcome too; a direct attempt is then a no-op.
        await deliverEmail(getContainer(), {
          template: "welcome",
          recipient: "customer",
          resource_id: customer.id,
          resource_type: "customer",
          trigger_type: "customer.created",
        })

        const [mail] = await mailTo(email, 1)
        expect(mail.Subject).toBe("Welcome to Tech Nest")
        expect(await textOf(mail.ID)).toContain("Hi Priya,")

        const rows = await notifications().listNotifications({ to: email, template: "welcome" })
        expect(rows.length).toBeGreaterThanOrEqual(1)
        for (const row of rows) {
          expect(row.status).toBe("success")
          expect(row.data).toEqual({ recipient: "customer" })
          expect(JSON.stringify(row)).not.toMatch(/Priya|Nair|Hi there|Welcome to Tech Nest/)
        }
      })
    })

    describe("the daily purge", () => {
      it("removes rows older than the retention period for good and keeps newer ones", async () => {
        const old = await sentRow("old")
        const older = await sentRow("older")
        const recent = await sentRow("recent")
        const fresh = await sentRow("fresh")
        await db().raw(`update notification set created_at = ? where id = ?`, [new Date(Date.now() - 91 * DAY), old])
        await db().raw(`update notification set created_at = ? where id = ?`, [new Date(Date.now() - 400 * DAY), older])
        await db().raw(`update notification set created_at = ? where id = ?`, [new Date(Date.now() - 89 * DAY), recent])

        delete process.env.NOTIFICATION_RETENTION_DAYS
        await notificationRetentionJob(getContainer())

        // Gone from the table, not soft-deleted: the address must not linger.
        expect(await idsInTable([old, older, recent, fresh])).toEqual([fresh, recent].sort())
        expect(await notifications().listNotifications({ id: [fresh, recent] })).toHaveLength(2)

        // A second run finds nothing more to do.
        await notificationRetentionJob(getContainer())
        expect(await idsInTable([recent, fresh])).toEqual([fresh, recent].sort())
      })

      it("honours NOTIFICATION_RETENTION_DAYS", async () => {
        const month = await sentRow("month")
        const week = await sentRow("week")
        await db().raw(`update notification set created_at = ? where id = ?`, [new Date(Date.now() - 31 * DAY), month])
        await db().raw(`update notification set created_at = ? where id = ?`, [new Date(Date.now() - 8 * DAY), week])

        process.env.NOTIFICATION_RETENTION_DAYS = "30"
        await notificationRetentionJob(getContainer())

        expect(await idsInTable([month, week])).toEqual([week])
      })
    })
  },
})
