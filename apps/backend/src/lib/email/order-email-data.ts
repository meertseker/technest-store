import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { OrderEmailData } from "@technest/emails"

/** Medusa stores money in major units (3.49). Our contracts use pence. */
export const toPence = (amount: unknown) => Math.round(Number(amount ?? 0) * 100)

export const storefrontUrl = () =>
  (process.env.STOREFRONT_URL || "https://technest.co.uk").replace(/\/$/, "")

export const shopNotifyEmail = () => process.env.SHOP_NOTIFY_EMAIL || "hello@technest.co.uk"

/**
 * True when the order's shipping method is a native pickup option (the
 * "Tech Nest pickup" fulfillment set, i.e. Click & Collect).
 */
export async function isPickupOrder(
  container: MedusaContainer,
  shippingOptionIds: (string | null | undefined)[]
): Promise<boolean> {
  const ids = shippingOptionIds.filter((id): id is string => !!id)
  if (!ids.length) return false
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "service_zone.fulfillment_set.type"],
    filters: { id: ids },
  })
  return data.some((o) => o.service_zone?.fulfillment_set?.type === "pickup")
}

export type LoadedOrderEmail = { email: string; data: OrderEmailData }

export async function loadOrderEmailData(
  container: MedusaContainer,
  orderId: string
): Promise<LoadedOrderEmail> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "item_total",
      "shipping_total",
      "discount_total",
      "tax_total",
      "total",
      "items.title",
      "items.product_title",
      "items.variant_title",
      "items.quantity",
      "items.unit_price",
      "items.total",
      "shipping_methods.name",
      "shipping_methods.shipping_option_id",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "shipping_address.address_1",
      "shipping_address.address_2",
      "shipping_address.city",
      "shipping_address.postal_code",
      "customer.first_name",
    ],
    filters: { id: orderId },
  })
  const order = orders[0]
  if (!order?.email) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${orderId} not found or has no email`)
  }

  const methods = order.shipping_methods ?? []
  const pickup = await isPickupOrder(
    container,
    methods.map((m) => m?.shipping_option_id)
  )
  const a = order.shipping_address

  return {
    email: order.email,
    data: {
      display_id: order.display_id ?? order.id,
      first_name: order.customer?.first_name || a?.first_name || null,
      items: (order.items ?? []).filter(Boolean).map((item) => ({
        title: item!.product_title || item!.title,
        variant_title: item!.variant_title,
        quantity: Number(item!.quantity),
        unit_price_pence: toPence(item!.unit_price),
        total_pence: toPence(item!.total),
      })),
      subtotal_pence: toPence(order.item_total),
      shipping_total_pence: toPence(order.shipping_total),
      discount_total_pence: toPence(order.discount_total),
      tax_total_pence: toPence(order.tax_total),
      total_pence: toPence(order.total),
      fulfilment: {
        type: pickup ? "collection" : "delivery",
        method_name: pickup ? "Click & Collect" : methods[0]?.name || "Delivery",
      },
      shipping_address: pickup || !a
        ? null
        : {
            name: [a.first_name, a.last_name].filter(Boolean).join(" ") || null,
            address_1: a.address_1,
            address_2: a.address_2,
            city: a.city,
            postcode: a.postal_code,
          },
      order_url: `${storefrontUrl()}/order/${order.id}/confirmed`,
    },
  }
}
