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

const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "original_item_total",
  "item_total",
  "shipping_total",
  "tax_total",
  "total",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.quantity",
  "items.unit_price",
  "items.original_total",
  "shipping_methods.name",
  "shipping_methods.shipping_option_id",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.postal_code",
  "customer.first_name",
]

type OrderRow = {
  id: string
  display_id?: number | null
  original_item_total?: unknown
  item_total?: unknown
  shipping_total?: unknown
  /** Not used: it also counts shipping discounts (see toOrderEmailData). */
  discount_total?: unknown
  tax_total?: unknown
  total?: unknown
  items?: ({
    title: string
    product_title?: string | null
    variant_title?: string | null
    quantity: unknown
    unit_price: unknown
    original_total?: unknown
    total?: unknown
  } | null)[] | null
  shipping_methods?: ({ name?: string | null; shipping_option_id?: string | null } | null)[] | null
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    address_1?: string | null
    address_2?: string | null
    city?: string | null
    postal_code?: string | null
  } | null
  customer?: { first_name?: string | null } | null
}

/**
 * Guests type their own name, and it appears in the greeting of a genuine
 * Tech Nest email. Drop anything that could smuggle in a link, address or
 * message (security review), falling back to "Hi there".
 */
export function safeFirstName(name?: string | null): string | null {
  const n = name?.trim()
  if (!n || n.length > 40) return null
  // Slashes, @, colons, angle brackets, backslashes, "www." or ".tld"-like text.
  if (/[/@:<>\\]|www\.|\.[a-z]{2,}/i.test(n)) return null
  return n
}

/**
 * Lines shown: items at their pre-discount price, one "Discount" line for
 * item promotions, delivery after any shipping promotion, then the total.
 * Those always add up: original_item_total - (original_item_total -
 * item_total) + shipping_total = item_total + shipping_total = total.
 * (Medusa's discount_total also counts shipping discounts, which are already
 * in shipping_total, so it isn't used.)
 */
export function toOrderEmailData(order: OrderRow, pickup: boolean): OrderEmailData {
  const a = order.shipping_address
  const subtotal = toPence(order.original_item_total ?? order.item_total)
  return {
    display_id: order.display_id ?? order.id,
    first_name: safeFirstName(order.customer?.first_name || a?.first_name),
    items: (order.items ?? []).filter((i): i is NonNullable<typeof i> => !!i).map((item) => ({
      title: item.product_title || item.title,
      variant_title: item.variant_title,
      quantity: Number(item.quantity),
      unit_price_pence: toPence(item.unit_price),
      total_pence: toPence(item.original_total),
    })),
    subtotal_pence: subtotal,
    discount_total_pence: subtotal - toPence(order.item_total),
    shipping_total_pence: toPence(order.shipping_total),
    tax_total_pence: toPence(order.tax_total),
    total_pence: toPence(order.total),
    fulfilment: {
      type: pickup ? "collection" : "delivery",
      method_name: pickup ? "Click & Collect" : order.shipping_methods?.[0]?.name || "Delivery",
    },
    shipping_address:
      pickup || !a
        ? null
        : {
            name: [a.first_name, a.last_name].filter(Boolean).join(" ") || null,
            address_1: a.address_1,
            address_2: a.address_2,
            city: a.city,
            postcode: a.postal_code,
          },
    order_url: `${storefrontUrl()}/order/${order.id}/confirmed`,
  }
}

/** `email` is null for orders without a customer address (e.g. admin-created). */
export type LoadedOrderEmail = { email: string | null; data: OrderEmailData }

export async function loadOrderEmailData(
  container: MedusaContainer,
  orderId: string
): Promise<LoadedOrderEmail> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = orders[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${orderId} not found`)
  }
  const pickup = await isPickupOrder(
    container,
    (order.shipping_methods ?? []).map((m) => m?.shipping_option_id)
  )
  return { email: order.email ?? null, data: toOrderEmailData(order as unknown as OrderRow, pickup) }
}
