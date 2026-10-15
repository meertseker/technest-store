import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { ICustomerModuleService, IPricingModuleService } from "@medusajs/framework/types"
import { deleteCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { purgeExpiredRecords } from "../../src/lib/data-retention"
import { tradeApplicationLockKey, tradeCustomerLockKey } from "../../src/workflows/steps/trade-locks"
import { seedTechNest } from "../../src/scripts/seed"
import { ensureTradePricing } from "../../src/scripts/seed/trade-pricing"
import { TRADE_MODULE } from "../../src/modules/trade"
import TradeModuleService from "../../src/modules/trade/service"
import { approveTradeApplicationWorkflow } from "../../src/workflows/approve-trade-application"
import { getProductTradeTiersWorkflow } from "../../src/workflows/get-product-trade-tiers"
import { rejectTradeApplicationWorkflow } from "../../src/workflows/reject-trade-application"
import { revokeTradeApplicationWorkflow } from "../../src/workflows/revoke-trade-application"
import { submitTradeApplicationWorkflow } from "../../src/workflows/submit-trade-application"
import { adminHeaders, storeHeaders } from "../helpers/auth"
import { customerHeaders } from "../helpers/customer"
import { waitForBackgroundWork } from "../helpers/background"
import { spyOnEvents } from "../helpers/events"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

const application = (over: Record<string, unknown> = {}) => ({
  company_name: "Acme Phones Ltd",
  vat_number: "gb 123 4567 89",
  companies_house_number: "sc 123456",
  business_type: "limited_company",
  contact: { name: "Jane Smith", phone: "020 7946 0000", email: "jane@acme.test" },
  ...over,
})

// The runner snapshots the DB after beforeAll and restores it before every
// test, so fixtures live in beforeAll and each test starts from them.
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    let store: Headers
    let regionId: string
    let tradeGroupId: string
    let priceListId: string
    let events: ReturnType<typeof spyOnEvents>
    const customers: Record<string, { customerId: string; headers: Record<string, string> }> = {}
    let productId: string
    let variants: { id: string; retail: number }[] = []
    let pendingId: string

    const as = (name: string) => ({ headers: customers[name].headers })
    const fail = (p: Promise<unknown>): Promise<any> => p.catch((e: any) => e.response)
    let approvedId: string

    const groupsOf = async (customerId: string) => {
      const customerService: ICustomerModuleService = getContainer().resolve(Modules.CUSTOMER)
      const customer = await customerService.retrieveCustomer(customerId, { relations: ["groups"] })
      return (customer.groups ?? []).map((g) => g.name)
    }

    /** Unit price the basket charges `who` for `quantity` of the tiered variant. */
    const unitPrice = async (who: string, quantity: number) => {
      const { data } = await api.post("/store/carts", { region_id: regionId }, as(who))
      const { data: withItem } = await api.post(
        `/store/carts/${data.cart.id}/line-items`,
        { variant_id: variants[0].id, quantity },
        as(who)
      )
      return withItem.cart.items[0].unit_price
    }

    beforeAll(async () => {
      const container = getContainer()
      const seeded = await seedTechNest(container)
      regionId = seeded.region.id
      const pricing = await ensureTradePricing(container)
      tradeGroupId = pricing.customer_group_id
      priceListId = pricing.price_list_id
      admin = await adminHeaders(api, container)
      store = await storeHeaders(container)
      for (const name of ["alice", "bob", "carol", "trader"]) {
        customers[name] = await customerHeaders(api, store, `${name}@technest.test`)
      }

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product",
        fields: ["id", "handle", "variants.id", "variants.variant_rank", "variants.prices.amount", "variants.prices.currency_code"],
        filters: { handle: "clear-shockproof-case" },
      })
      productId = data[0].id as string
      variants = (data[0].variants as any[]).map((v) => ({
        id: v.id,
        retail: Number(v.prices.find((p: any) => p.currency_code === "gbp").amount),
      }))

      // The basket test buys up to 60: give that variant plenty of stock (the
      // shop sells tracked stock only, so it can't simply stop tracking).
      const { data: stock } = await query.graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: variants[0].id },
      })
      await container.resolve(Modules.INVENTORY).updateInventoryLevels([
        {
          inventory_item_id: (stock[0] as any).inventory_items[0].inventory_item_id,
          location_id: seeded.stockLocation.id,
          stocked_quantity: 1000,
        },
      ])

      // Tiers for the first variant: VAT-inclusive major units, like retail prices.
      await api.post(
        `/admin/price-lists/${priceListId}/prices/batch`,
        {
          create: [
            { variant_id: variants[0].id, currency_code: "gbp", amount: 7.5, min_quantity: 1, max_quantity: 9 },
            { variant_id: variants[0].id, currency_code: "gbp", amount: 7, min_quantity: 10, max_quantity: 49 },
            { variant_id: variants[0].id, currency_code: "gbp", amount: 6, min_quantity: 50 },
          ],
        },
        admin
      )

      const { data: traderApp } = await api.post("/store/trade-applications", application(), as("trader"))
      approvedId = traderApp.trade_application.id
      await api.post(`/admin/trade-applications/${approvedId}/approve`, {}, admin)

      const { data: bobApp } = await api.post(
        "/store/trade-applications",
        application({ company_name: "Bob Repairs", vat_number: null, companies_house_number: null, business_type: "sole_trader" }),
        as("bob")
      )
      pendingId = bobApp.trade_application.id

      // The fixtures above emit events whose subscribers (emails) run in the
      // background: let them finish before the runner snapshots the DB.
      await waitForBackgroundWork(container)
      events = spyOnEvents(container)
    })

    beforeEach(() => {
      events.spy.mockClear()
    })

    // Requests in a test emit events whose subscribers (emails) keep running
    // after the response. The runner's own afterEach only waits for workflows
    // that have already started, so wait for those still to come too before
    // the next restore cuts their DB connections.
    afterEach(() => waitForBackgroundWork(getContainer()))

    describe("store: submit and status", () => {
      it("requires a logged-in customer", async () => {
        expect((await fail(api.post("/store/trade-applications", application(), store))).status).toBe(401)
        expect((await fail(api.get("/store/trade-applications/me", store))).status).toBe(401)
      })

      it("returns null before the customer has applied", async () => {
        const { data } = await api.get("/store/trade-applications/me", as("alice"))
        expect(data).toEqual({ trade_application: null })
      })

      it("submits a normalised pending application and emits created", async () => {
        const { data } = await api.post("/store/trade-applications", application(), as("alice"))
        expect(data.trade_application).toEqual({
          id: expect.stringMatching(/^tapp_/),
          customer_id: customers.alice.customerId,
          company_name: "Acme Phones Ltd",
          vat_number: "GB123456789",
          companies_house_number: "SC123456",
          business_type: "limited_company",
          contact: { name: "Jane Smith", phone: "020 7946 0000", email: "jane@acme.test" },
          status: "pending",
          reason: null,
          created_at: expect.any(String),
          updated_at: expect.any(String),
        })
        expect(events.emitted("technest.trade_application.created")).toEqual([
          { id: data.trade_application.id, customer_id: customers.alice.customerId },
        ])

        const me = await api.get("/store/trade-applications/me", as("alice"))
        expect(me.data.trade_application.id).toBe(data.trade_application.id)
      })

      it("allows only one pending application per customer", async () => {
        const err = await fail(api.post("/store/trade-applications", application(), as("bob")))
        expect(err.status).toBe(400)
        expect(err.data.message).toBe("You already have a pending trade application")
      })

      it("refuses a new application from an approved trade customer", async () => {
        const err = await fail(api.post("/store/trade-applications", application(), as("trader")))
        expect(err.status).toBe(400)
        expect(err.data.message).toBe("Your trade account is already approved")
      })

      it("lets a rejected customer apply again and returns the newest application", async () => {
        await api.post(`/admin/trade-applications/${pendingId}/reject`, { reason: "No trading history" }, admin)
        const { data } = await api.post("/store/trade-applications", application(), as("bob"))
        const me = await api.get("/store/trade-applications/me", as("bob"))
        expect(me.data.trade_application).toMatchObject({ id: data.trade_application.id, status: "pending" })
      })

      it("validates the body and never takes customer_id from it", async () => {
        const cases = [
          application({ vat_number: "12345" }),
          application({ companies_house_number: "123" }),
          application({ business_type: "charity" }),
          application({ company_name: "  " }),
          application({ contact: { name: "J", phone: "call me", email: "jane@acme.test" } }),
          application({ contact: { name: "J", phone: "020 7946 0000", email: "nope" } }),
          application({ customer_id: customers.bob.customerId }),
        ]
        for (const body of cases) {
          const err = await fail(api.post("/store/trade-applications", body, as("carol")))
          expect(err.status).toBe(400)
        }
        const me = await api.get("/store/trade-applications/me", as("carol"))
        expect(me.data.trade_application).toBeNull()
      })

      it("rolls back the application when a later step fails", async () => {
        const container = getContainer()
        events.failNext("technest.trade_application.created")
        const { errors } = await submitTradeApplicationWorkflow(container).run({
          input: {
            customer_id: customers.carol.customerId,
            company_name: "Rollback Ltd",
            business_type: "other",
            contact_name: "R",
            contact_phone: "020 7946 0001",
            contact_email: "r@example.com",
          },
          throwOnError: false,
        })
        expect(errors.length).toBeGreaterThan(0)
        const tradeService: TradeModuleService = container.resolve(TRADE_MODULE)
        expect(await tradeService.listTradeApplications({ customer_id: customers.carol.customerId })).toHaveLength(0)
        // The lock was released: the customer can still apply.
        const { data } = await api.post("/store/trade-applications", application(), as("carol"))
        expect(data.trade_application.status).toBe("pending")
      })

      it("treats empty optional ids as null", async () => {
        const { data } = await api.post(
          "/store/trade-applications",
          application({ vat_number: "", companies_house_number: "" }),
          as("carol")
        )
        expect(data.trade_application).toMatchObject({ vat_number: null, companies_house_number: null })
      })
    })

    describe("admin: list and get", () => {
      it("requires admin auth", async () => {
        const requests = (config?: unknown) => [
          api.get("/admin/trade-applications", config),
          api.get(`/admin/trade-applications/${pendingId}`, config),
          api.post(`/admin/trade-applications/${pendingId}/approve`, {}, config),
          api.post(`/admin/trade-applications/${pendingId}/reject`, { reason: "x" }, config),
          api.post(`/admin/trade-applications/${approvedId}/revoke`, {}, config),
          api.delete(`/admin/trade-applications/${pendingId}`, config),
        ]
        // No credentials, and a logged-in customer is not an admin.
        for (const config of [undefined, as("alice")]) {
          for (const request of requests(config)) {
            expect((await fail(request)).status).toBe(401)
          }
        }
        const tradeService: TradeModuleService = getContainer().resolve(TRADE_MODULE)
        expect((await tradeService.retrieveTradeApplication(pendingId)).status).toBe("pending")
        expect((await tradeService.retrieveTradeApplication(approvedId)).status).toBe("approved")
      })

      it("lists with status filter and pagination", async () => {
        const all = await api.get("/admin/trade-applications", admin)
        expect(all.data).toMatchObject({ count: 2, limit: 20, offset: 0 })
        expect(all.data.trade_applications.map((a: any) => a.company_name)).toEqual(["Bob Repairs", "Acme Phones Ltd"])

        const pending = await api.get("/admin/trade-applications?status=pending", admin)
        expect(pending.data.trade_applications.map((a: any) => a.id)).toEqual([pendingId])

        const both = await api.get("/admin/trade-applications?status=pending&status=approved&limit=1&offset=1&order=created_at", admin)
        expect(both.data).toMatchObject({ count: 2, limit: 1, offset: 1 })
        expect(both.data.trade_applications[0].id).toBe(pendingId)

        const bad = await fail(api.get("/admin/trade-applications?status=maybe", admin))
        expect(bad.status).toBe(400)
      })

      it("gets one application or 404", async () => {
        const { data } = await api.get(`/admin/trade-applications/${pendingId}`, admin)
        expect(data.trade_application).toMatchObject({ id: pendingId, company_name: "Bob Repairs", business_type: "sole_trader" })
        expect((await fail(api.get("/admin/trade-applications/tapp_missing", admin))).status).toBe(404)
      })
    })

    describe("admin: approve", () => {
      it("approves, adds the customer to the Trade group and emits approved", async () => {
        const { data } = await api.post(`/admin/trade-applications/${pendingId}/approve`, {}, admin)
        expect(data.trade_application).toMatchObject({ id: pendingId, status: "approved", reason: null })
        expect(await groupsOf(customers.bob.customerId)).toEqual(["Trade"])
        expect(events.emitted("technest.trade_application.approved")).toEqual([
          { id: pendingId, customer_id: customers.bob.customerId },
        ])
      })

      it("accepts an approve request without a body", async () => {
        const { data } = await api.post(`/admin/trade-applications/${pendingId}/approve`, undefined, admin)
        expect(data.trade_application.status).toBe("approved")
      })

      it("only approves pending applications", async () => {
        await api.post(`/admin/trade-applications/${pendingId}/approve`, {}, admin)
        const err = await fail(api.post(`/admin/trade-applications/${pendingId}/approve`, {}, admin))
        expect(err.status).toBe(400)
        expect((await fail(api.post("/admin/trade-applications/tapp_missing/approve", {}, admin))).status).toBe(404)
      })

      it("creates the Trade group when it is missing", async () => {
        const customerService: ICustomerModuleService = getContainer().resolve(Modules.CUSTOMER)
        await customerService.deleteCustomerGroups(tradeGroupId)
        await api.post(`/admin/trade-applications/${pendingId}/approve`, {}, admin)
        const groups = await customerService.listCustomerGroups({ name: "Trade" })
        expect(groups).toHaveLength(1)
        expect(await groupsOf(customers.bob.customerId)).toEqual(["Trade"])
      })

      it("two first approvals at once create one Trade group with both customers in it", async () => {
        const customerService: ICustomerModuleService = getContainer().resolve(Modules.CUSTOMER)
        await customerService.deleteCustomerGroups(tradeGroupId)
        const { data: carolApp } = await api.post(
          "/store/trade-applications",
          application({ company_name: "Carol Cases" }),
          as("carol")
        )
        const responses = await Promise.all(
          [pendingId, carolApp.trade_application.id].map((id) =>
            fail(api.post(`/admin/trade-applications/${id}/approve`, {}, admin))
          )
        )
        expect(responses.map((r) => r.status)).toEqual([200, 200])
        expect(await customerService.listCustomerGroups({ name: "Trade" })).toHaveLength(1)
        expect(await groupsOf(customers.bob.customerId)).toEqual(["Trade"])
        expect(await groupsOf(customers.carol.customerId)).toEqual(["Trade"])
      })

      it("rolls back membership, the new group and the status when a later step fails", async () => {
        const container = getContainer()
        const customerService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
        await customerService.deleteCustomerGroups(tradeGroupId)
        events.failNext("technest.trade_application.approved")

        const { errors } = await approveTradeApplicationWorkflow(container).run({
          input: { id: pendingId },
          throwOnError: false,
        })
        expect(errors.length).toBeGreaterThan(0)

        const tradeService: TradeModuleService = container.resolve(TRADE_MODULE)
        expect((await tradeService.retrieveTradeApplication(pendingId)).status).toBe("pending")
        expect(await customerService.listCustomerGroups({ name: "Trade" })).toHaveLength(0)
        expect(await groupsOf(customers.bob.customerId)).toEqual([])
      })

      it("keeps an existing Trade group when rolling back", async () => {
        const container = getContainer()
        events.failNext("technest.trade_application.approved")
        const { errors } = await approveTradeApplicationWorkflow(container).run({
          input: { id: pendingId },
          throwOnError: false,
        })
        expect(errors.length).toBeGreaterThan(0)
        const customerService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
        expect(await customerService.listCustomerGroups({ id: tradeGroupId })).toHaveLength(1)
        expect(await groupsOf(customers.bob.customerId)).toEqual([])
        expect(await groupsOf(customers.trader.customerId)).toEqual(["Trade"])
      })
    })

    describe("admin: reject", () => {
      it("requires a non-blank reason", async () => {
        for (const body of [{}, { reason: "" }, { reason: "   " }]) {
          const err = await fail(api.post(`/admin/trade-applications/${pendingId}/reject`, body, admin))
          expect(err.status).toBe(400)
        }
        const { errors } = await rejectTradeApplicationWorkflow(getContainer()).run({
          input: { id: pendingId, reason: "  " },
          throwOnError: false,
        })
        expect(errors[0].error.message).toBe("A reason is required to reject a trade application")
      })

      it("rejects with a reason and emits rejected", async () => {
        const { data } = await api.post(
          `/admin/trade-applications/${pendingId}/reject`,
          { reason: "  Please add your VAT number  " },
          admin
        )
        expect(data.trade_application).toMatchObject({ status: "rejected", reason: "Please add your VAT number" })
        expect(events.emitted("technest.trade_application.rejected")).toEqual([
          { id: pendingId, customer_id: customers.bob.customerId, reason: "Please add your VAT number" },
        ])
        const again = await fail(api.post(`/admin/trade-applications/${pendingId}/reject`, { reason: "x" }, admin))
        expect(again.status).toBe(400)
      })

      it("rolls back the status when a later step fails", async () => {
        const container = getContainer()
        events.failNext("technest.trade_application.rejected")
        const { errors } = await rejectTradeApplicationWorkflow(container).run({
          input: { id: pendingId, reason: "No" },
          throwOnError: false,
        })
        expect(errors.length).toBeGreaterThan(0)
        const tradeService: TradeModuleService = container.resolve(TRADE_MODULE)
        expect(await tradeService.retrieveTradeApplication(pendingId)).toMatchObject({ status: "pending", reason: null })
      })
    })

    describe("admin: revoke", () => {
      /** Puts the fixture trader back to "approved and in the group" inside a test. */
      const reinstateTrader = async () => {
        const tradeService: TradeModuleService = getContainer().resolve(TRADE_MODULE)
        await tradeService.updateTradeApplications({ id: approvedId, status: "approved", reason: null })
        if (!(await groupsOf(customers.trader.customerId)).length) {
          const customerService: ICustomerModuleService = getContainer().resolve(Modules.CUSTOMER)
          await customerService.addCustomerToGroup({
            customer_id: customers.trader.customerId,
            customer_group_id: tradeGroupId,
          })
        }
      }

      it("revokes an approved account: status, group, tiers, basket price and re-apply", async () => {
        const { data } = await api.post(
          `/admin/trade-applications/${approvedId}/revoke`,
          { reason: "  Account closed at the customer's request  " },
          admin
        )
        expect(data.trade_application).toMatchObject({
          id: approvedId,
          status: "revoked",
          reason: "Account closed at the customer's request",
        })
        expect(events.emitted("technest.trade_application.revoked")).toEqual([
          { id: approvedId, customer_id: customers.trader.customerId },
        ])
        expect(await groupsOf(customers.trader.customerId)).toEqual([])

        const me = await api.get("/store/trade-applications/me", as("trader"))
        expect(me.data.trade_application).toMatchObject({ id: approvedId, status: "revoked" })

        const tiers = await fail(api.get(`/store/products/${productId}/trade-tiers`, as("trader")))
        expect(tiers.status).toBe(403)
        expect(await unitPrice("trader", 10)).toBe(variants[0].retail)

        const again = await api.post("/store/trade-applications", application(), as("trader"))
        expect(again.data.trade_application.status).toBe("pending")
        const latest = await api.get("/store/trade-applications/me", as("trader"))
        expect(latest.data.trade_application.id).toBe(again.data.trade_application.id)

        const revoked = await api.get("/admin/trade-applications?status=revoked", admin)
        expect(revoked.data.trade_applications.map((a: any) => a.id)).toEqual([approvedId])
      })

      it("reprices the customer's open baskets at retail, so a trade-priced basket can't be checked out", async () => {
        const { data } = await api.post("/store/carts", { region_id: regionId }, as("trader"))
        const { data: withItem } = await api.post(
          `/store/carts/${data.cart.id}/line-items`,
          { variant_id: variants[0].id, quantity: 10 },
          as("trader")
        )
        expect(withItem.cart.items[0].unit_price).toBe(7)

        await api.post(`/admin/trade-applications/${approvedId}/revoke`, {}, admin)

        // Reading the basket does not reprice it: the revoke must have done so.
        const { data: after } = await api.get(`/store/carts/${data.cart.id}`, as("trader"))
        expect(after.cart.items[0].unit_price).toBe(variants[0].retail)
        expect(after.cart.items[0].quantity).toBe(10)
      })

      it("accepts no reason, an empty body and a blank reason (stored as null)", async () => {
        for (const body of [undefined, {}, { reason: "" }, { reason: "   " }]) {
          await reinstateTrader()
          const { data } = await api.post(`/admin/trade-applications/${approvedId}/revoke`, body, admin)
          expect(data.trade_application).toMatchObject({ status: "revoked", reason: null })
          expect(await groupsOf(customers.trader.customerId)).toEqual([])
        }
      })

      it("validates the body", async () => {
        for (const body of [{ reason: "x".repeat(501) }, { reason: 5 }, { note: "x" }]) {
          const err = await fail(api.post(`/admin/trade-applications/${approvedId}/revoke`, body, admin))
          expect(err.status).toBe(400)
        }
        const tradeService: TradeModuleService = getContainer().resolve(TRADE_MODULE)
        expect((await tradeService.retrieveTradeApplication(approvedId)).status).toBe("approved")
        expect(await groupsOf(customers.trader.customerId)).toEqual(["Trade"])
      })

      it("only revokes approved applications", async () => {
        const err = await fail(api.post(`/admin/trade-applications/${pendingId}/revoke`, {}, admin))
        expect(err.status).toBe(400)
        expect(err.data.type).toBe("invalid_data")
        expect((await fail(api.post("/admin/trade-applications/tapp_missing/revoke", {}, admin))).status).toBe(404)
        await api.post(`/admin/trade-applications/${approvedId}/revoke`, {}, admin)
        expect((await fail(api.post(`/admin/trade-applications/${approvedId}/revoke`, {}, admin))).status).toBe(400)
      })

      it("still revokes when the customer was already taken out of the group by hand", async () => {
        const customerService: ICustomerModuleService = getContainer().resolve(Modules.CUSTOMER)
        await customerService.removeCustomerFromGroup({
          customer_id: customers.trader.customerId,
          customer_group_id: tradeGroupId,
        })
        const { data } = await api.post(`/admin/trade-applications/${approvedId}/revoke`, {}, admin)
        expect(data.trade_application.status).toBe("revoked")
      })

      it("rolls back the status and the group membership when a later step fails", async () => {
        const container = getContainer()
        events.failNext("technest.trade_application.revoked")
        const { errors } = await revokeTradeApplicationWorkflow(container).run({
          input: { id: approvedId, reason: "No" },
          throwOnError: false,
        })
        expect(errors.length).toBeGreaterThan(0)
        const tradeService: TradeModuleService = container.resolve(TRADE_MODULE)
        expect(await tradeService.retrieveTradeApplication(approvedId)).toMatchObject({ status: "approved", reason: null })
        expect(await groupsOf(customers.trader.customerId)).toEqual(["Trade"])
        expect((await api.get(`/store/products/${productId}/trade-tiers`, as("trader"))).status).toBe(200)
      })
    })

    describe("admin: delete, and personal data retention", () => {
      const DAY = 24 * 60 * 60 * 1000
      const tradeService = () => getContainer().resolve<TradeModuleService>(TRADE_MODULE)
      const stored = (filters: Record<string, unknown> = {}) =>
        tradeService().listTradeApplications(filters, { select: ["id"], take: null, withDeleted: true })

      it("refuses to delete an active trade account, deletes it once revoked", async () => {
        const active = await fail(api.delete(`/admin/trade-applications/${approvedId}`, admin))
        expect(active.status).toBe(400)
        expect(active.data.message).toMatch(/revoke/i)
        expect((await tradeService().retrieveTradeApplication(approvedId)).status).toBe("approved")

        await api.post(`/admin/trade-applications/${approvedId}/revoke`, {}, admin)
        const { data } = await api.delete(`/admin/trade-applications/${approvedId}`, admin)
        expect(data).toEqual({ id: approvedId, object: "trade_application", deleted: true })
        expect((await fail(api.get(`/admin/trade-applications/${approvedId}`, admin))).status).toBe(404)
        expect((await fail(api.delete(`/admin/trade-applications/${approvedId}`, admin))).status).toBe(404)
        expect((await fail(api.delete("/admin/trade-applications/tapp_missing", admin))).status).toBe(404)

        // Gone for the customer too: they may apply afresh.
        const me = await api.get("/store/trade-applications/me", as("trader"))
        expect(me.data.trade_application).toBeNull()
      })

      it("deletes a pending application and a rejected one", async () => {
        await api.delete(`/admin/trade-applications/${pendingId}`, admin)
        const list = await api.get("/admin/trade-applications", admin)
        expect(list.data.trade_applications.map((a: any) => a.id)).toEqual([approvedId])
        const { data: again } = await api.post("/store/trade-applications", application(), as("bob"))
        await api.post(`/admin/trade-applications/${again.trade_application.id}/reject`, { reason: "No" }, admin)
        const { data } = await api.delete(`/admin/trade-applications/${again.trade_application.id}`, admin)
        expect(data.deleted).toBe(true)
      })

      it("deletes a customer's applications when the customer account is deleted", async () => {
        const container = getContainer()
        await deleteCustomersWorkflow(container).run({ input: { ids: [customers.bob.customerId] } })
        await waitForBackgroundWork(container)
        expect(await tradeService().listTradeApplications({ customer_id: customers.bob.customerId })).toEqual([])
        // Soft-deleted, so the retention job can remove it for good later.
        expect(await stored({ customer_id: customers.bob.customerId })).toHaveLength(1)
        // Other customers' applications are untouched.
        expect((await tradeService().retrieveTradeApplication(approvedId)).status).toBe("approved")
      })

      it("retention: rejected, revoked and deleted applications are removed for good after TRADE_RETENTION_DAYS", async () => {
        const container = getContainer()
        await api.post(`/admin/trade-applications/${pendingId}/reject`, { reason: "No" }, admin)
        await api.post(`/admin/trade-applications/${approvedId}/revoke`, {}, admin)
        const { data: fresh } = await api.post("/store/trade-applications", application(), as("carol"))
        await api.delete(`/admin/trade-applications/${fresh.trade_application.id}`, admin)
        const { data: open } = await api.post("/store/trade-applications", application(), as("alice"))

        expect(await purgeExpiredRecords(container, { now: new Date(), env: { TRADE_RETENTION_DAYS: "30" } })).toEqual({
          repair_bookings: 0,
          trade_applications: 0,
        })
        expect((await stored()).map((a) => a.id).sort()).toEqual(
          [pendingId, approvedId, fresh.trade_application.id, open.trade_application.id].sort()
        )

        const later = new Date(Date.now() + 31 * DAY)
        expect(await purgeExpiredRecords(container, { now: later, env: { TRADE_RETENTION_DAYS: "30" } })).toEqual({
          repair_bookings: 0,
          trade_applications: 3,
        })
        expect((await stored()).map((a) => a.id)).toEqual([open.trade_application.id])
      })
    })

    describe("busy locks answer 409, not 500", () => {
      const holding = async (key: string, run: () => Promise<unknown>) => {
        const locking = getContainer().resolve(Modules.LOCKING)
        await locking.acquire(key, { ownerId: "test-holder", expire: 60 })
        try {
          return await run()
        } finally {
          await locking.release(key, { ownerId: "test-holder" })
        }
      }

      it("approve, reject, revoke and delete while the application is locked", async () => {
        await holding(tradeApplicationLockKey(pendingId), async () => {
          for (const request of [
            api.post(`/admin/trade-applications/${pendingId}/approve`, {}, admin),
            api.post(`/admin/trade-applications/${pendingId}/reject`, { reason: "x" }, admin),
            api.delete(`/admin/trade-applications/${pendingId}`, admin),
          ]) {
            const err = await fail(request)
            expect(err.status).toBe(409)
            expect(err.data).toEqual({ type: "conflict", message: expect.stringMatching(/another request/i) })
          }
        })
        await holding(tradeApplicationLockKey(approvedId), async () => {
          expect((await fail(api.post(`/admin/trade-applications/${approvedId}/revoke`, {}, admin))).status).toBe(409)
        })
        expect((await tradeService().retrieveTradeApplication(pendingId)).status).toBe("pending")
        expect((await tradeService().retrieveTradeApplication(approvedId)).status).toBe("approved")
      })

      it("a new application while the customer is locked", async () => {
        await holding(tradeCustomerLockKey(customers.carol.customerId), async () => {
          const err = await fail(api.post("/store/trade-applications", application(), as("carol")))
          expect(err.status).toBe(409)
          expect(err.data.type).toBe("conflict")
        })
        const me = await api.get("/store/trade-applications/me", as("carol"))
        expect(me.data.trade_application).toBeNull()
      })

      const tradeService = () => getContainer().resolve<TradeModuleService>(TRADE_MODULE)
    })

    describe("trade pricing", () => {
      it("creates the Trade group and price list once (idempotent)", async () => {
        const container = getContainer()
        const again = await ensureTradePricing(container)
        expect(again).toEqual({ customer_group_id: tradeGroupId, price_list_id: priceListId })

        const customerService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
        expect(await customerService.listCustomerGroups({ name: "Trade" })).toHaveLength(1)

        const pricingService: IPricingModuleService = container.resolve(Modules.PRICING)
        const lists = (await pricingService.listPriceLists({}, { relations: ["price_list_rules"] })).filter(
          (l) => l.title === "Trade"
        )
        expect(lists).toHaveLength(1)
        expect(lists[0]).toMatchObject({ type: "override", status: "active" })
        expect(lists[0].price_list_rules?.map((r) => [r.attribute, r.value])).toEqual([
          ["customer.groups.id", [tradeGroupId]],
        ])
      })

      it("only serves tiers to approved trade customers", async () => {
        expect((await fail(api.get(`/store/products/${productId}/trade-tiers`, store))).status).toBe(401)
        const err = await fail(api.get(`/store/products/${productId}/trade-tiers`, as("carol")))
        expect(err.status).toBe(403)
        expect(err.data.message).toBe("Trade pricing is only available to approved trade accounts")
        // Pending is not approved.
        expect((await fail(api.get(`/store/products/${productId}/trade-tiers`, as("bob")))).status).toBe(403)
      })

      it("returns ex-VAT tiers in pence per variant", async () => {
        const { data } = await api.get(`/store/products/${productId}/trade-tiers`, as("trader"))
        expect(data).toMatchObject({
          product_id: productId,
          currency_code: "gbp",
          price_label: "ex VAT",
          vat_rate_percent: 20,
        })
        expect(data.variants).toHaveLength(variants.length)
        const first = data.variants.find((v: any) => v.variant_id === variants[0].id)
        expect(first.retail_inc_vat_pence).toBe(Math.round(variants[0].retail * 100))
        expect(first.tiers).toEqual([
          { min_quantity: 1, max_quantity: 9, unit_price_ex_vat_pence: 625, unit_price_inc_vat_pence: 750 },
          { min_quantity: 10, max_quantity: 49, unit_price_ex_vat_pence: 583, unit_price_inc_vat_pence: 700 },
          { min_quantity: 50, max_quantity: null, unit_price_ex_vat_pence: 500, unit_price_inc_vat_pence: 600 },
        ])
        for (const other of data.variants.filter((v: any) => v.variant_id !== variants[0].id)) {
          expect(other.tiers).toEqual([])
        }
      })

      it("enforces the trade-account check in the workflow, not only the route", async () => {
        const container = getContainer()
        const { data: channels } = await container
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "product_sales_channel", fields: ["sales_channel_id"], filters: { product_id: productId } })
        const sales_channel_ids = channels.map((c) => c.sales_channel_id as string)

        const denied = await getProductTradeTiersWorkflow(container).run({
          input: { customer_id: customers.carol.customerId, product_id: productId, sales_channel_ids },
          throwOnError: false,
        })
        expect(denied.errors[0].error.message).toBe("Trade pricing is only available to approved trade accounts")

        const hidden = await getProductTradeTiersWorkflow(container).run({
          input: { customer_id: customers.trader.customerId, product_id: productId, sales_channel_ids: [] },
          throwOnError: false,
        })
        expect(hidden.errors[0].error.message).toBe(`Product with id: ${productId} was not found`)

        const { result } = await getProductTradeTiersWorkflow(container).run({
          input: { customer_id: customers.trader.customerId, product_id: productId, sales_channel_ids },
        })
        expect(result.product_id).toBe(productId)
        expect(result.variants).toHaveLength(variants.length)
      })

      it("returns 404 for an unknown product", async () => {
        expect((await fail(api.get("/store/products/prod_missing/trade-tiers", as("trader")))).status).toBe(404)
      })

      it("charges trade customers the tier price in the basket", async () => {
        expect(await unitPrice("trader", 5)).toBe(7.5)
        expect(await unitPrice("trader", 10)).toBe(7)
        expect(await unitPrice("trader", 60)).toBe(6)
        expect(await unitPrice("carol", 10)).toBe(variants[0].retail)
      })

      it("keeps approvals and tiers working after the group and price list are renamed", async () => {
        await api.post(`/admin/customer-groups/${tradeGroupId}`, { name: "Trade accounts" }, admin)
        await api.post(`/admin/price-lists/${priceListId}`, { title: "Wholesale" }, admin)

        // Existing trade customers keep their prices.
        expect((await api.get(`/store/products/${productId}/trade-tiers`, as("trader"))).status).toBe(200)
        expect(await unitPrice("trader", 10)).toBe(7)

        // A new approval joins the renamed group instead of creating a second "Trade" group.
        await api.post(`/admin/trade-applications/${pendingId}/approve`, {}, admin)
        expect(await groupsOf(customers.bob.customerId)).toEqual(["Trade accounts"])
        const customerService: ICustomerModuleService = getContainer().resolve(Modules.CUSTOMER)
        expect(await customerService.listCustomerGroups({ name: "Trade" })).toHaveLength(0)

        const { data } = await api.get(`/store/products/${productId}/trade-tiers`, as("bob"))
        const first = data.variants.find((v: any) => v.variant_id === variants[0].id)
        expect(first.tiers).toHaveLength(3)
        expect(await unitPrice("bob", 10)).toBe(7)
        expect(await unitPrice("bob", 60)).toBe(6)
      })
    })
  },
})
