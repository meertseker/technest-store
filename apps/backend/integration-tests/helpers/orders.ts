import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createOrderPaymentCollectionWorkflow,
  createOrderWorkflow,
} from "@medusajs/medusa/core-flows"

export const TEST_PROVIDER_ID = "pp_recording_test"

/** Shipping option ids by type code ("standard", "click-collect", ...) from the seed. */
export async function shippingOptionIdsByCode(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "shipping_option", fields: ["id", "type.code"] })
  const ids: Record<string, string> = {}
  for (const o of data) ids[o.type!.code as string] = o.id as string
  return ids
}

/**
 * An order as a completed cart leaves it: items, one shipping method, and a
 * payment collection whose session is authorised (not captured) by the
 * recording test provider.
 */
export async function placeAuthorisedOrder(
  container: MedusaContainer,
  opts: { regionId: string; shippingOptionId: string; shippingAmount: number; email?: string }
) {
  const { result: order } = await createOrderWorkflow(container).run({
    input: {
      region_id: opts.regionId,
      email: opts.email ?? "test-customer@example.com",
      currency_code: "gbp",
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
          name: "Shipping",
          amount: opts.shippingAmount,
          shipping_option_id: opts.shippingOptionId,
          is_tax_inclusive: true,
        },
      ],
    },
  })

  const amount = Math.round((2 * 4.99 + opts.shippingAmount) * 100) / 100
  const { result: collections } = await createOrderPaymentCollectionWorkflow(container).run({
    input: { order_id: order.id, amount },
  })
  const payments = container.resolve(Modules.PAYMENT)
  const session = await payments.createPaymentSession(collections[0].id, {
    provider_id: TEST_PROVIDER_ID,
    amount,
    currency_code: "gbp",
    data: {},
  })
  const payment = await payments.authorizePaymentSession(session.id, {})
  return { order, amount, payment_id: payment!.id }
}

export async function paymentOf(container: MedusaContainer, paymentId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "payment",
    fields: ["id", "captured_at", "canceled_at", "captures.id", "refunds.amount"],
    filters: { id: paymentId },
  })
  return data[0]
}

export async function orderOf(container: MedusaContainer, orderId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "status", "metadata", "fulfillments.id", "fulfillments.delivered_at", "fulfillments.canceled_at"],
    filters: { id: orderId },
  })
  return data[0]
}

/** Collects emitted events by name (the in-memory event bus in tests). */
export function recordEvents(container: MedusaContainer, names: string[]) {
  const seen: { name: string; data: any }[] = []
  const bus = container.resolve(Modules.EVENT_BUS)
  for (const name of names) {
    bus.subscribe(
      name,
      async (event: any) => {
        seen.push({ name, data: event.data })
      },
      { subscriberId: `test-recorder-${name}` }
    )
  }
  return {
    for: (name: string, match: Record<string, unknown> = {}) =>
      seen.filter(
        (e) => e.name === name && Object.entries(match).every(([k, v]) => e.data?.[k] === v)
      ),
    clear: () => {
      seen.length = 0
    },
  }
}

/** Waits for async event delivery to settle. */
export const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms))
