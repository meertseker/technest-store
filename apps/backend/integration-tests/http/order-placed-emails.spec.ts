import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOrderWorkflow } from "@medusajs/medusa/core-flows"
import orderPlacedEmails from "../../src/subscribers/order-placed-emails"
import { seedTechNest } from "../../src/scripts/seed"

jest.setTimeout(300 * 1000)

// Shop alerts go to a unique address so this test only sees its own mail in
// the shared dev Mailpit (SMTP 1025, API 8025). Never delete the mailbox.
const RUN = Date.now()
process.env.SHOP_NOTIFY_EMAIL = `e2-shop-${RUN}@example.com`
const MAILPIT_API = process.env.MAILPIT_API_URL || "http://localhost:8025/api/v1"

async function mailTo(to: string, expected: number) {
  let messages: { Subject: string; ID: string }[] = []
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:"${to}"`)}`)
    messages = ((await res.json()) as { messages: { Subject: string; ID: string }[] }).messages ?? []
    if (messages.length >= expected) break
    await new Promise((r) => setTimeout(r, 250))
  }
  return messages
}

async function textOf(id: string) {
  const res = await fetch(`${MAILPIT_API}/message/${id}`)
  return ((await res.json()) as { Text: string }).Text
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    describe("order.placed emails", () => {
      let regionId: string
      const optionIds: Record<string, string> = {}

      beforeAll(async () => {
        await seedTechNest(getContainer())
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data: regions } = await query.graph({
          entity: "region",
          fields: ["id"],
          filters: { currency_code: "gbp" },
        })
        regionId = regions[0].id
        const { data: options } = await query.graph({
          entity: "shipping_option",
          fields: ["id", "type.code"],
        })
        for (const o of options) optionIds[o.type!.code] = o.id
      })

      async function placeOrder(email: string, optionCode: string, shippingAmount: number) {
        const { result } = await createOrderWorkflow(getContainer()).run({
          input: {
            region_id: regionId,
            email,
            currency_code: "gbp",
            // Like real UK orders from a cart: prices include VAT.
            items: [
              { title: "USB-C cable", variant_title: "1 m", quantity: 2, unit_price: 4.99, is_tax_inclusive: true },
            ],
            shipping_address: {
              first_name: "Sam",
              last_name: "Smith",
              address_1: "1 High St",
              city: "London",
              postal_code: "SE16 1AA",
              country_code: "gb",
            },
            shipping_methods: [
              {
                name: optionCode,
                amount: shippingAmount,
                shipping_option_id: optionIds[optionCode],
                is_tax_inclusive: true,
              },
            ],
          },
        })
        return result
      }

      it("sends the customer confirmation and the shop alert for a delivery order", async () => {
        const email = `e2-delivery-${RUN}@example.com`
        const order = await placeOrder(email, "standard", 3.49)

        await orderPlacedEmails({ event: { name: "order.placed", data: { id: order.id } }, container: getContainer() } as any)

        const [confirmation] = await mailTo(email, 1)
        expect(confirmation.Subject).toBe(`Order confirmed: #${order.display_id}`)
        const text = await textOf(confirmation.ID)
        expect(text).toContain("USB-C cable")
        expect(text).toContain("£9.98")
        expect(text).toContain("£13.47")
        expect(text).toContain("1 High St")
        expect(text).toContain("14 days")

        const shop = await mailTo(process.env.SHOP_NOTIFY_EMAIL!, 1)
        expect(shop.map((m) => m.Subject)).toContain(`New order #${order.display_id} · Delivery · £13.47`)
      })

      it("flags Click & Collect orders and tells the customer to bring the order number", async () => {
        const email = `e2-collect-${RUN}@example.com`
        const order = await placeOrder(email, "click-collect", 0)

        await orderPlacedEmails({ event: { name: "order.placed", data: { id: order.id } }, container: getContainer() } as any)

        const [confirmation] = await mailTo(email, 1)
        expect(await textOf(confirmation.ID)).toMatch(/bring your order number/i)
        const shop = await mailTo(process.env.SHOP_NOTIFY_EMAIL!, 2)
        expect(shop.map((m) => m.Subject)).toContain(
          `New order #${order.display_id} · CLICK & COLLECT · £9.98`
        )
      })

      it("does not email twice when order.placed is delivered twice", async () => {
        const email = `e2-dupe-${RUN}@example.com`
        const order = await placeOrder(email, "standard", 3.49)
        const event = { event: { name: "order.placed", data: { id: order.id } }, container: getContainer() } as any

        await orderPlacedEmails(event)
        await orderPlacedEmails(event)

        await mailTo(email, 2) // wait long enough that a duplicate would have arrived
        expect(await mailTo(email, 1)).toHaveLength(1)
      })
    })
  },
})
