import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { asValue } from "@medusajs/framework/awilix"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCustomersWorkflow } from "@medusajs/medusa/core-flows"
import lowStockDigestEmail from "../../src/subscribers/low-stock-digest-email"
import repairBookingEmail from "../../src/subscribers/repair-booking-email"
import tradeApplicationEmails from "../../src/subscribers/trade-application-emails"
import { seedTechNest } from "../../src/scripts/seed"
import { mailTo, settle, textOf } from "../utils/mailpit"
import { warmDb } from "../utils/warm-db"

jest.setTimeout(300 * 1000)

const RUN = Date.now()
process.env.SHOP_NOTIFY_EMAIL = `e2-shop-trade-${RUN}@example.com`
process.env.ADMIN_URL = "https://admin.technest.co.uk/app"

/**
 * The trade and repair modules are E1's (e1/trade-repair, not merged yet), so
 * their rows are served by a stand-in for `query.graph` on those two entities
 * (shapes from docs/contracts/trade.md and repairs.md). Everything else (the
 * customer, the send-email workflow, send-once, SMTP) is real.
 */
const tradeApplications: Record<string, Record<string, unknown>> = {}
const repairBookings: Record<string, Record<string, unknown>> = {}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    describe("trade, repair and low-stock emails", () => {
      beforeAll(async () => {
        await seedTechNest(getContainer())
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const stand: Record<string, Record<string, Record<string, unknown>>> = {
          trade_application: tradeApplications,
          repair_booking: repairBookings,
        }
        const graph = async (config: any, ...rest: any[]) => {
          const rows = stand[config.entity]
          if (!rows) return (query.graph as any).call(query, config, ...rest)
          const row = rows[config.filters?.id]
          return { data: row ? [row] : [], metadata: undefined }
        }
        container.register(
          ContainerRegistrationKeys.QUERY,
          asValue(
            new Proxy(query, {
              get: (t, k) => {
                if (k === "graph") return graph
                const v = (t as any)[k]
                return typeof v === "function" ? v.bind(t) : v
              },
            })
          )
        )
      })

      beforeEach(() => warmDb(getContainer()))

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

      function application(id: string, customer_id: string, extra: object = {}) {
        tradeApplications[id] = {
          id,
          customer_id,
          company_name: "Acme Phones Ltd",
          vat_number: "GB123456789",
          companies_house_number: "01234567",
          business_type: "limited_company",
          contact_name: "Jane Smith",
          contact_phone: "020 7946 0000",
          contact_email: `typed-${RUN}@elsewhere.example.com`,
          status: "pending",
          reason: null,
          ...extra,
        }
      }

      it("created: receipt to the account email (not the typed one) and an alert to the shop, once", async () => {
        const email = `e2-trade-new-${RUN}@example.com`
        const c = await customer(email)
        application("tapp_new", c.id)

        const payload = { id: "tapp_new", customer_id: c.id }
        await emit(tradeApplicationEmails, "technest.trade_application.created", payload)
        await emit(tradeApplicationEmails, "technest.trade_application.created", payload) // duplicate event

        const [receipt] = await tradeMail(email, 2)
        expect(receipt.Subject).toBe("We've received your trade account application")
        expect(await textOf(receipt.ID)).toContain("Acme Phones Ltd")

        const shop = await mailTo(process.env.SHOP_NOTIFY_EMAIL!, 1)
        expect(shop.map((m) => m.Subject)).toContain("New trade application: Acme Phones Ltd")
        const alert = shop.find((m) => m.Subject === "New trade application: Acme Phones Ltd")!
        const text = await textOf(alert.ID)
        expect(text).toContain("Jane Smith")
        expect(text).toContain("https://admin.technest.co.uk/app/trade-applications/tapp_new")

        expect(await settle(`typed-${RUN}@elsewhere.example.com`, 500)).toHaveLength(0)
        expect(await tradeMail(email, 3)).toHaveLength(1)
        expect(
          (await mailTo(process.env.SHOP_NOTIFY_EMAIL!, 2)).filter((m) => m.Subject.startsWith("New trade application"))
        ).toHaveLength(1)

        // Workflow executions persist their input: ids only.
        const executions = await getContainer().resolve(Modules.WORKFLOW_ENGINE).listWorkflowExecutions({})
        const stored = JSON.stringify(executions)
        expect(stored).not.toContain(email)
        expect(stored).not.toContain("020 7946 0000")
      })

      it("approved and rejected: one email each, with the stored reason", async () => {
        const email = `e2-trade-decided-${RUN}@example.com`
        const c = await customer(email)
        application("tapp_ok", c.id, { status: "approved" })
        application("tapp_no", c.id, { status: "rejected", reason: "We couldn't verify the VAT number." })

        await emit(tradeApplicationEmails, "technest.trade_application.approved", { id: "tapp_ok", customer_id: c.id })
        const [approved] = await tradeMail(email, 2)
        expect(approved.Subject).toBe("Your Tech Nest trade account is approved")

        await emit(tradeApplicationEmails, "technest.trade_application.rejected", {
          id: "tapp_no",
          customer_id: c.id,
          reason: "ignored: the stored reason is used",
        })
        const both = await tradeMail(email, 3)
        const rejected = both.find((m) => m.Subject === "About your Tech Nest trade account application")!
        expect(await textOf(rejected.ID)).toContain("Reason: We couldn't verify the VAT number.")
      })

      it("sends no approval for an application that isn't approved", async () => {
        const email = `e2-trade-pending-${RUN}@example.com`
        const c = await customer(email)
        application("tapp_pending", c.id)
        await emit(tradeApplicationEmails, "technest.trade_application.approved", { id: "tapp_pending", customer_id: c.id })
        await settle(email)
        expect(await tradeMail(email, 0)).toHaveLength(0)
      })

      it("repair booking: alerts the shop only", async () => {
        const typed = `e2-repair-${RUN}@example.com`
        repairBookings.rep_1 = {
          id: "rep_1",
          name: "Sam Jones",
          phone: "07700 900123",
          email: typed,
          device: "iPhone 13 mini",
          device_id: null,
          fault: "Cracked screen, touch still works",
          preferred_time: "Weekday mornings",
          status: "new",
          notes: "staff-only note",
        }
        await emit(repairBookingEmail, "technest.repair_booking.created", { id: "rep_1" })

        const shop = await mailTo(process.env.SHOP_NOTIFY_EMAIL!, 1)
        const alert = shop.find((m) => m.Subject === "Repair request: iPhone 13 mini")
        expect(alert).toBeDefined()
        const text = await textOf(alert!.ID)
        expect(text).toContain("Cracked screen, touch still works")
        expect(text).not.toContain("staff-only note")
        expect(await settle(typed, 500)).toHaveLength(0)
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
