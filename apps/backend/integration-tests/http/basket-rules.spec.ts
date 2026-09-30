import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { seedTechNest } from "../../src/scripts/seed"
import { ADDON_MULTIBUY, seedPromotions } from "../../src/scripts/seed/promotions"
import { ADDON_ONLY_MESSAGE } from "../../src/lib/basket-rules"
import { getBasketRulesWorkflow } from "../../src/workflows/get-basket-rules"
import { storeHeaders } from "../helpers/auth"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let store: Headers
    let regionId: string
    const variantByHandle: Record<string, string> = {}
    const optionByCode: Record<string, string> = {}

    const fail = (e: any) => e.response

    async function createCart(items: { variant_id: string; quantity: number }[]) {
      const { data } = await api.post(
        "/store/carts",
        {
          region_id: regionId,
          email: "shopper@technest.test",
          shipping_address: {
            first_name: "Sam",
            last_name: "Shopper",
            address_1: "1 Test Street",
            city: "London",
            postal_code: "SE16 3TU",
            country_code: "gb",
          },
          items,
        },
        store
      )
      return data.cart
    }

    const rules = async (cartId: string) =>
      (await api.get(`/store/carts/${cartId}/basket-rules`, store)).data.basket_rules

    const addShipping = (cartId: string, code: string) =>
      api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: optionByCode[code] }, store)

    async function pay(cartId: string) {
      const { data } = await api.post("/store/payment-collections", { cart_id: cartId }, store)
      await api.post(
        `/store/payment-collections/${data.payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        store
      )
    }

    beforeAll(async () => {
      const container = getContainer()
      await seedTechNest(container)
      store = await storeHeaders(container)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)

      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id

      const { data: variants } = await query.graph({
        entity: "product_variant",
        fields: ["id", "product.handle"],
      })
      for (const v of variants) variantByHandle[v.product!.handle as string] ??= v.id

      const { data: options } = await query.graph({
        entity: "shipping_option",
        fields: ["id", "type.code"],
      })
      for (const o of options) optionByCode[o.type!.code as string] = o.id

      // Part of the snapshot every test starts from (the runner restores the
      // database before each test).
      const seeded = await seedPromotions(container)
      expect(seeded.created).toBe(true)
    })

    describe("add-on rule", () => {
      it("reports an add-on only basket and refuses delivery for it", async () => {
        const cart = await createCart([
          { variant_id: variantByHandle["phone-ring-holder"], quantity: 2 },
        ])

        expect(await rules(cart.id)).toEqual({
          addon_only: true,
          delivery_allowed: false,
          message: ADDON_ONLY_MESSAGE,
        })

        for (const code of ["standard", "next-day"]) {
          const res = await addShipping(cart.id, code).catch(fail)
          expect(res.status).toBe(400)
          expect(res.data).toMatchObject({ type: "not_allowed", message: ADDON_ONLY_MESSAGE })
        }

        // Click & Collect is exempt, and the order completes.
        const collect = await addShipping(cart.id, "click-collect")
        expect(collect.status).toBe(200)
        await pay(cart.id)
        const done = await api.post(`/store/carts/${cart.id}/complete`, {}, store)
        expect(done.data.type).toBe("order")
      })

      it("allows delivery once a normal item is in the basket", async () => {
        const cart = await createCart([
          { variant_id: variantByHandle["phone-ring-holder"], quantity: 1 },
          { variant_id: variantByHandle["clear-shockproof-case"], quantity: 1 },
        ])
        expect(await rules(cart.id)).toEqual({
          addon_only: false,
          delivery_allowed: true,
          message: null,
        })
        const res = await addShipping(cart.id, "standard")
        expect(res.status).toBe(200)
      })

      it("refuses to complete when the normal item was removed after choosing delivery", async () => {
        const cart = await createCart([
          { variant_id: variantByHandle["phone-ring-holder"], quantity: 1 },
          { variant_id: variantByHandle["clear-shockproof-case"], quantity: 1 },
        ])
        await addShipping(cart.id, "standard")
        const caseLine = cart.items.find(
          (i: any) => i.variant_id === variantByHandle["clear-shockproof-case"]
        )
        await api.delete(`/store/carts/${cart.id}/line-items/${caseLine.id}`, store)
        expect((await rules(cart.id)).addon_only).toBe(true)

        await pay(cart.id)
        const res = await api.post(`/store/carts/${cart.id}/complete`, {}, store).catch(fail)
        expect(res.status).toBe(400)
        expect(res.data).toMatchObject({ type: "not_allowed", message: ADDON_ONLY_MESSAGE })

        // Switching to Click & Collect fixes it (the total changed, so pay again).
        await addShipping(cart.id, "click-collect")
        await pay(cart.id)
        const done = await api.post(`/store/carts/${cart.id}/complete`, {}, store)
        expect(done.data.type).toBe("order")
      })

      it("an empty basket is not add-on only", async () => {
        const cart = await createCart([])
        expect(await rules(cart.id)).toMatchObject({ addon_only: false, delivery_allowed: true })
      })

      it("404s for an unknown cart", async () => {
        const res = await api.get("/store/carts/cart_nope/basket-rules", store).catch(fail)
        expect(res.status).toBe(404)
      })

      it("runs as a workflow", async () => {
        const cart = await createCart([
          { variant_id: variantByHandle["screen-cleaning-cloth"], quantity: 1 },
        ])
        const { result } = await getBasketRulesWorkflow(getContainer()).run({
          input: { cart_id: cart.id },
        })
        expect(result.addon_only).toBe(true)
      })
    })

    describe("add-on multi-buy promotion", () => {
      it("is idempotent", async () => {
        const again = await seedPromotions(getContainer())
        expect(again).toMatchObject({ created: false, reason: "exists" })
      })

      const cartTotals = async (cartId: string) =>
        (
          await api.get(
            `/store/carts/${cartId}?fields=item_total,discount_total,*promotions`,
            store
          )
        ).data.cart

      it("makes any 3 add-ons £2, mixed products included", async () => {
        const cart = await createCart([
          { variant_id: variantByHandle["phone-ring-holder"], quantity: 2 },
          { variant_id: variantByHandle["screen-cleaning-cloth"], quantity: 1 },
        ])
        const totals = await cartTotals(cart.id)
        expect(totals.discount_total).toBe(1)
        expect(totals.item_total).toBe(2)
        expect(totals.promotions.map((p: any) => p.code)).toContain(ADDON_MULTIBUY.code)
      })

      it("repeats for 6 and doesn't apply to 2", async () => {
        const six = await createCart([
          { variant_id: variantByHandle["phone-ring-holder"], quantity: 6 },
        ])
        expect((await cartTotals(six.id)).item_total).toBe(4)

        const two = await createCart([
          { variant_id: variantByHandle["phone-ring-holder"], quantity: 2 },
        ])
        expect((await cartTotals(two.id)).discount_total).toBe(0)
      })

      it("ignores non-add-on items", async () => {
        const cart = await createCart([
          { variant_id: variantByHandle["phone-ring-holder"], quantity: 2 },
          { variant_id: variantByHandle["clear-shockproof-case"], quantity: 1 },
        ])
        expect((await cartTotals(cart.id)).discount_total).toBe(0)
      })
    })
  },
})
