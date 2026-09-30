import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { asValue } from "@medusajs/framework/awilix"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCustomersWorkflow } from "@medusajs/medusa/core-flows"
import lowStockDigestEmail from "../../src/subscribers/low-stock-digest-email"
import repairBookingEmail from "../../src/subscribers/repair-booking-email"
import tradeApplicationEmails from "../../src/subscribers/trade-application-emails"
import { TURNSTILE_VERIFIER_KEY } from "../../src/lib/turnstile"
import { seedTechNest } from "../../src/scripts/seed"
import { approveTradeApplicationWorkflow } from "../../src/workflows/approve-trade-application"
import { createRepairBookingWorkflow } from "../../src/workflows/create-repair-booking"
import { rejectTradeApplicationWorkflow } from "../../src/workflows/reject-trade-application"
import { submitTradeApplicationWorkflow } from "../../src/workflows/submit-trade-application"
import { waitForBackgroundWork } from "../helpers/background"
import { mailTo, mailWithSubject, settle, textOf } from "../utils/mailpit"
import { warmDb } from "../utils/warm-db"

jest.setTimeout(300 * 1000)

const RUN = Date.now()
process.env.SHOP_NOTIFY_EMAIL = `e2-shop-trade-${RUN}@example.com`
process.env.ADMIN_URL = "https://admin.technest.co.uk/app"

/**
 * End to end with E1's trade and repair modules: the records are created by
 * their real workflows, whose events reach the email subscribers through the
 * event bus. Duplicate events are replayed by calling the subscriber directly.
 */
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    describe("trade, repair and low-stock emails", () => {
      beforeAll(async () => {
        const container = getContainer()
        container.register(TURNSTILE_VERIFIER_KEY, asValue(async () => true))
        await seedTechNest(container)
      })

      beforeEach(() => warmDb(getContainer()))
      // The workflows below emit events; let their email subscribers finish before the next restore.
      afterEach(() => waitForBackgroundWork(getContainer()))

      // The real customer.created subscriber also sends a welcome; ignore it here.
      const tradeMail = async (to: string, n: number) =>
        (await mailTo(to, n)).filter((m) => m.Subject !== "Welcome to Tech Nest")

      const emit = (fn: any, name: string, data: object) =>
        fn({ event: { name, data }, container: getContainer() } as any)

      async function customer(email: string) {
        const {
          result: [c],
        } = await createCustomersWorkflow(getContainer()).run({
          input: { customersData: [{ email, first_name: "Jane", has_account: true }] },
        })
        return c
      }

      // Unique per attempt: jest retries a failed test against the same shared mailbox.
      let seq = 0
      const uid = () => `${RUN}-${++seq}`
      const unique = (label: string) => `${label} ${uid()}`

      async function apply(customer_id: string, company_name = unique("Acme Phones")) {
        const { result } = await submitTradeApplicationWorkflow(getContainer()).run({
          input: {
            customer_id,
            company_name,
            vat_number: "GB123456789",
            companies_house_number: "01234567",
            business_type: "limited_company",
            contact_name: "Jane Smith",
            contact_phone: "020 7946 0000",
            contact_email: `typed-${RUN}@elsewhere.example.com`,
          },
        })
        return result as { id: string }
      }

      it("created: receipt to the account email (not the typed one) and an alert to the shop, once", async () => {
        const email = `e2-trade-new-${uid()}@example.com`
        const c = await customer(email)
        const company = unique("Acme Phones")
        const app = await apply(c.id, company)

        const [receipt] = await tradeMail(email, 1)
        expect(receipt.Subject).toBe("We've received your trade account application")
        expect(await textOf(receipt.ID)).toContain(company)

        const alertSubject = `New trade application: ${company}`
        const [alert] = await mailWithSubject(process.env.SHOP_NOTIFY_EMAIL!, alertSubject)
        expect(alert).toBeDefined()
        const text = await textOf(alert.ID)
        expect(text).toContain("Jane Smith")
        expect(text).toContain(`https://admin.technest.co.uk/app/trade-applications/${app.id}`)

        // A duplicate event sends nothing more.
        await emit(tradeApplicationEmails, "technest.trade_application.created", { id: app.id, customer_id: c.id })
        expect(await settle(`typed-${RUN}@elsewhere.example.com`, 500)).toHaveLength(0)
        expect(await tradeMail(email, 2)).toHaveLength(1)
        expect(await mailWithSubject(process.env.SHOP_NOTIFY_EMAIL!, alertSubject)).toHaveLength(1)

        // Workflow executions persist their input: ids only.
        const executions = await getContainer().resolve(Modules.WORKFLOW_ENGINE).listWorkflowExecutions({})
        const stored = JSON.stringify(executions)
        expect(stored).not.toContain(email)
        expect(stored).not.toContain("020 7946 0000")
      })

      it("approved and rejected: one email each, with the stored reason", async () => {
        const okEmail = `e2-trade-approved-${uid()}@example.com`
        const ok = await apply((await customer(okEmail)).id)
        await approveTradeApplicationWorkflow(getContainer()).run({ input: { id: ok.id } })
        const approved = (await tradeMail(okEmail, 2)).filter(
          (m) => m.Subject === "Your Tech Nest trade account is approved"
        )
        expect(approved).toHaveLength(1)

        const noEmail = `e2-trade-rejected-${uid()}@example.com`
        const no = await customer(noEmail)
        const rejectedApp = await apply(no.id)
        await rejectTradeApplicationWorkflow(getContainer()).run({
          input: { id: rejectedApp.id, reason: "We couldn't verify the VAT number." },
        })
        const subject = "About your Tech Nest trade account application"
        const rejected = (await tradeMail(noEmail, 2)).find((m) => m.Subject === subject)!
        expect(rejected).toBeDefined()
        expect(await textOf(rejected.ID)).toContain("Reason: We couldn't verify the VAT number.")

        // The event's reason is ignored: the stored one is used, and a replay sends nothing new.
        await emit(tradeApplicationEmails, "technest.trade_application.rejected", {
          id: rejectedApp.id,
          customer_id: no.id,
          reason: "ignored: the stored reason is used",
        })
        await settle(noEmail, 500)
        expect((await tradeMail(noEmail, 2)).filter((m) => m.Subject === subject)).toHaveLength(1)
      })

      it("sends no approval for an application that isn't approved", async () => {
        const email = `e2-trade-pending-${uid()}@example.com`
        const c = await customer(email)
        const app = await apply(c.id)
        await tradeMail(email, 1) // the receipt
        await emit(tradeApplicationEmails, "technest.trade_application.approved", { id: app.id, customer_id: c.id })
        await settle(email)
        const mail = await tradeMail(email, 0)
        expect(mail.map((m) => m.Subject)).toEqual(["We've received your trade account application"])
      })

      it("repair booking: alerts the shop only", async () => {
        const typed = `e2-repair-${uid()}@example.com`
        const device = unique("iPhone 13 mini")
        const { result: booking } = await createRepairBookingWorkflow(getContainer()).run({
          input: {
            name: "Sam Jones",
            phone: "07700 900123",
            email: typed,
            device,
            fault: "Cracked screen, touch still works",
            preferred_time: "Weekday mornings",
            turnstile_token: "test-token",
          },
        })

        const subject = `Repair request: ${device}`
        const [alert] = await mailWithSubject(process.env.SHOP_NOTIFY_EMAIL!, subject)
        expect(alert).toBeDefined()
        const text = await textOf(alert.ID)
        expect(text).toContain("Cracked screen, touch still works")
        expect(text).toContain(`https://admin.technest.co.uk/app/repair-bookings/${booking.id}`)

        // The customer gets nothing, and a replayed event sends nothing new.
        await emit(repairBookingEmail, "technest.repair_booking.created", { id: booking.id })
        expect(await settle(typed, 500)).toHaveLength(0)
        expect(await mailWithSubject(process.env.SHOP_NOTIFY_EMAIL!, subject)).toHaveLength(1)
      })

      it("low-stock digest: one per day, listing the variants", async () => {
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data: variants } = await query.graph({
          entity: "product_variant",
          fields: ["id", "sku"],
          pagination: { take: 2 },
        })
        const items = variants.map((v) => ({
          variant_id: v.id,
          sku: v.sku,
          title: "from the job",
          stocked_quantity: 1,
          threshold: 3,
        }))

        await emit(lowStockDigestEmail, "technest.inventory.low_stock", { items: [] })
        await emit(lowStockDigestEmail, "technest.inventory.low_stock", { items })
        await emit(lowStockDigestEmail, "technest.inventory.low_stock", { items }) // same-day re-run

        const digests = (await mailTo(process.env.SHOP_NOTIFY_EMAIL!, 1)).filter((m) =>
          m.Subject.startsWith("Low stock:")
        )
        expect(digests).toHaveLength(1)
        expect(digests[0].Subject).toMatch(/^Low stock: 2 items to reorder \(\w+day \d+ \w+\)$/)
        const text = await textOf(digests[0].ID)
        for (const v of variants) expect(text).toContain(v.sku!)
        expect(text).toMatch(/\d+ left \(min \d+\)/)
      })
    })
  },
})
