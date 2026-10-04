// Medusa attaches a cart to the registered customer whose email it carries (findOrCreateCustomerStep), without
// asking who is calling. For a trade customer that would give a guest the Trade prices, so the email of a
// customer in a customer group can only be used on a cart by that customer, signed in.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { seedTechNest } from "../../src/scripts/seed"
import { ensureTradePricing } from "../../src/scripts/seed/trade-pricing"
import { adminHeaders, storeHeaders } from "../helpers/auth"
import { waitForBackgroundWork } from "../helpers/background"
import { customerHeaders } from "../helpers/customer"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

const TRADER_EMAIL = "trader@technest.test"
const TRADE_PRICE = 5 // Trade price-list tier 1-9, VAT-inclusive major units; retail is 6.99
const QUANTITY = 5

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    /** Publishable key only: no session, no bearer token. */
    let guest: Headers
    let trader: { customerId: string; headers: Record<string, string> }
    let regionId: string
    let variantId: string
    let retail: number
    let tradeGroupId: string

    beforeAll(async () => {
      const container = getContainer()
      const seeded = await seedTechNest(container)
      regionId = seeded.region.id
      const pricing = await ensureTradePricing(container)
      tradeGroupId = pricing.customer_group_id
      admin = await adminHeaders(api, container)
      guest = await storeHeaders(container)
      trader = await customerHeaders(api, guest, TRADER_EMAIL)

      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product",
        fields: ["id", "variants.id", "variants.prices.amount", "variants.prices.currency_code"],
        filters: { handle: "clear-shockproof-case" },
      })
      const variant = (data[0].variants as any[])[0]
      variantId = variant.id
      retail = Number(variant.prices.find((p: any) => p.currency_code === "gbp").amount)

      await api.post(
        `/admin/price-lists/${pricing.price_list_id}/prices/batch`,
        {
          create: [
            { variant_id: variantId, currency_code: "gbp", amount: TRADE_PRICE, min_quantity: 1, max_quantity: 9 },
          ],
        },
        admin
      )

      const { data: app } = await api.post(
        "/store/trade-applications",
        {
          company_name: "Acme Phones Ltd",
          vat_number: "GB123456789",
          companies_house_number: "SC123456",
          business_type: "limited_company",
          contact: { name: "Jane Smith", phone: "020 7946 0000", email: "jane@acme.test" },
        },
        { headers: trader.headers }
      )
      await api.post(`/admin/trade-applications/${app.trade_application.id}/approve`, {}, admin)
      await waitForBackgroundWork(container)
    })

    afterEach(() => waitForBackgroundWork(getContainer()))

    /** The cart as stored, not as the store API chooses to serialise it. */
    const storedCart = async (cartId: string) => {
      const { data } = await getContainer().resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "cart",
        fields: ["id", "email", "customer_id", "items.unit_price", "items.quantity"],
        filters: { id: cartId },
      })
      const cart = data[0] as any
      return {
        is_the_traders_cart: cart.customer_id === trader.customerId,
        unit_price: Number(cart.items[0].unit_price),
      }
    }

    it("control: the trade price is real (logged-in trader pays it, a guest without that email pays retail)", async () => {
      expect(TRADE_PRICE).toBeLessThan(retail)

      const asTrader = { headers: trader.headers }
      const { data: t } = await api.post("/store/carts", { region_id: regionId }, asTrader)
      const { data: tItem } = await api.post(
        `/store/carts/${t.cart.id}/line-items`,
        { variant_id: variantId, quantity: QUANTITY },
        asTrader
      )
      expect(tItem.cart.items[0].unit_price).toBe(TRADE_PRICE)

      const { data: g } = await api.post(
        "/store/carts",
        { region_id: regionId, email: "someone-else@example.com" },
        guest
      )
      const { data: gItem } = await api.post(
        `/store/carts/${g.cart.id}/line-items`,
        { variant_id: variantId, quantity: QUANTITY },
        guest
      )
      expect(gItem.cart.items[0].unit_price).toBe(retail)
    })

    const tradersCarts = async () => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "cart", fields: ["id"], filters: { customer_id: trader.customerId } })
      return data.length
    }

    /** What a refused request looks like to the storefront. */
    const refusal = (res: any) => ({ status: res.status, type: res.data?.type, message: res.data?.message })
    const SIGN_IN = {
      status: 401,
      type: "unauthorized",
      message: "This email belongs to a trade account. Sign in to use it.",
    }

    it.each([
      ["with the items in the same call", TRADER_EMAIL, true],
      ["without items", TRADER_EMAIL, false],
      ["typed in another letter case", "Trader@TechNest.Test", false],
    ])("a guest can't create a cart with the trader's email (%s)", async (_label, email, withItems) => {
      const before = await tradersCarts()
      const items = withItems ? { items: [{ variant_id: variantId, quantity: QUANTITY }] } : {}

      const res = await api
        .post("/store/carts", { region_id: regionId, email, ...items }, guest)
        .catch((e: any) => e.response)

      expect(refusal(res)).toEqual(SIGN_IN)
      expect(await tradersCarts()).toBe(before)
    })

    it("a guest can't put the trader's email on an existing cart, and the cart keeps retail prices", async () => {
      const { data } = await api.post("/store/carts", { region_id: regionId }, guest)
      const cartId = data.cart.id as string
      await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantId, quantity: QUANTITY }, guest)

      const res = await api.post(`/store/carts/${cartId}`, { email: TRADER_EMAIL }, guest).catch((e: any) => e.response)
      // Any later basket change reprices the lines with the cart's customer.
      await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantId, quantity: 1 }, guest)

      expect(refusal(res)).toEqual(SIGN_IN)
      expect(await storedCart(cartId)).toEqual({ is_the_traders_cart: false, unit_price: retail })
    })

    it("the signed-in trader can still use their own email on a cart", async () => {
      const asTrader = { headers: trader.headers }
      const { data } = await api.post(
        "/store/carts",
        { region_id: regionId, email: TRADER_EMAIL, items: [{ variant_id: variantId, quantity: QUANTITY }] },
        asTrader
      )

      expect(await storedCart(data.cart.id)).toEqual({ is_the_traders_cart: true, unit_price: TRADE_PRICE })
    })

    it("another signed-in customer can't put the trader's email on a cart either", async () => {
      const other = await customerHeaders(api, guest, "someone@technest.test")
      // A cart with no customer yet: Medusa would attach it to whoever owns the email it is given.
      const { data } = await api.post("/store/carts", { region_id: regionId }, guest)
      const cartId = data.cart.id as string
      await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantId, quantity: QUANTITY }, guest)

      const res = await api
        .post(`/store/carts/${cartId}`, { email: TRADER_EMAIL }, { headers: other.headers })
        .catch((e: any) => e.response)
      await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantId, quantity: 1 }, guest)

      expect(refusal(res)).toEqual(SIGN_IN)
      expect(await storedCart(cartId)).toEqual({ is_the_traders_cart: false, unit_price: retail })
    })

    it("a guest can't use the email of a trade customer staff created without a login", async () => {
      const { data: created } = await api.post("/admin/customers", { email: "counter-trade@technest.test" }, admin)
      await api.post(`/admin/customer-groups/${tradeGroupId}/customers`, { add: [created.customer.id] }, admin)

      const res = await api
        .post(
          "/store/carts",
          { region_id: regionId, email: "counter-trade@technest.test", items: [{ variant_id: variantId, quantity: QUANTITY }] },
          guest
        )
        .catch((e: any) => e.response)

      expect(refusal(res)).toEqual(SIGN_IN)
    })

    it("a registered customer without special prices can still check out as a guest with their email", async () => {
      await customerHeaders(api, guest, "regular@technest.test")

      const { data } = await api.post(
        "/store/carts",
        { region_id: regionId, email: "regular@technest.test", items: [{ variant_id: variantId, quantity: QUANTITY }] },
        guest
      )

      expect(data.cart.items[0].unit_price).toBe(retail)
    })
  },
})
