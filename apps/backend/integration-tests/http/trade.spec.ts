import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { ICustomerModuleService, IPricingModuleService } from "@medusajs/framework/types"
import { seedTechNest } from "../../src/scripts/seed"
import { ensureTradePricing } from "../../src/scripts/seed/trade-pricing"
import { TRADE_MODULE } from "../../src/modules/trade"
import TradeModuleService from "../../src/modules/trade/service"
import { approveTradeApplicationWorkflow } from "../../src/workflows/approve-trade-application"
import { rejectTradeApplicationWorkflow } from "../../src/workflows/reject-trade-application"
import { adminHeaders, storeHeaders } from "../helpers/auth"
import { customerHeaders } from "../helpers/customer"
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
      await api.post(`/admin/trade-applications/${traderApp.trade_application.id}/approve`, {}, admin)

      const { data: bobApp } = await api.post(
        "/store/trade-applications",
        application({ company_name: "Bob Repairs", vat_number: null, companies_house_number: null, business_type: "sole_trader" }),
        as("bob")
      )
      pendingId = bobApp.trade_application.id

      events = spyOnEvents(container)
    })

    beforeEach(() => {
      events.spy.mockClear()
    })

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
        expect((await fail(api.get("/admin/trade-applications"))).status).toBe(401)
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
      const groupsOf = async (customerId: string) => {
        const customerService: ICustomerModuleService = getContainer().resolve(Modules.CUSTOMER)
        const customer = await customerService.retrieveCustomer(customerId, { relations: ["groups"] })
        return (customer.groups ?? []).map((g) => g.name)
      }

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

      it("rolls back membership, the new group and the status when a later step fails", async () => {
        const container = getContainer()
        const customerService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
        await customerService.deleteCustomerGroups(tradeGroupId)
        events.spy.mockRejectedValueOnce(new Error("event bus down"))

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
        events.spy.mockRejectedValueOnce(new Error("event bus down"))
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
        events.spy.mockRejectedValueOnce(new Error("event bus down"))
        const { errors } = await rejectTradeApplicationWorkflow(container).run({
          input: { id: pendingId, reason: "No" },
          throwOnError: false,
        })
        expect(errors.length).toBeGreaterThan(0)
        const tradeService: TradeModuleService = container.resolve(TRADE_MODULE)
        expect(await tradeService.retrieveTradeApplication(pendingId)).toMatchObject({ status: "pending", reason: null })
      })
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

      it("returns 404 for an unknown product", async () => {
        expect((await fail(api.get("/store/products/prod_missing/trade-tiers", as("trader")))).status).toBe(404)
      })

      it("charges trade customers the tier price in the basket", async () => {
        const unitPrice = async (who: string, quantity: number) => {
          const { data } = await api.post("/store/carts", { region_id: regionId }, as(who))
          const { data: withItem } = await api.post(
            `/store/carts/${data.cart.id}/line-items`,
            { variant_id: variants[0].id, quantity },
            as(who)
          )
          return withItem.cart.items[0].unit_price
        }
        expect(await unitPrice("trader", 5)).toBe(7.5)
        expect(await unitPrice("trader", 10)).toBe(7)
        expect(await unitPrice("trader", 60)).toBe(6)
        expect(await unitPrice("carol", 10)).toBe(variants[0].retail)
      })
    })
  },
})
