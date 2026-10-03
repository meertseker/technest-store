// Shapes of docs/contracts/delivery-orders.md, as the admin UI reads them.

export type DeliveryStatus = "to_pack" | "shipped"

export type DeliveryOrderItem = {
  id: string
  title: string
  variant_title: string | null
  quantity: number
  thumbnail: string | null
}

export type DeliveryOrder = {
  id: string
  display_id: number | null
  status: DeliveryStatus
  created_at: string
  email: string | null
  customer_name: string | null
  postcode: string | null
  city: string | null
  items: DeliveryOrderItem[]
  total_pence: number
  shipped_at: string | null
}

export type DeliveryListResponse = {
  orders: DeliveryOrder[]
  count: number
  limit: number
  offset: number
}

export type ShippedResponse = {
  order_id: string
  fulfillment_id: string | null
  already_shipped: boolean
}

/** "2 × USB-C cable (1 m), 1 × Case" */
export function deliverySummary(order: Pick<DeliveryOrder, "items">): string {
  return order.items
    .map((i) => `${i.quantity} × ${i.title}${i.variant_title ? ` (${i.variant_title})` : ""}`)
    .join(", ")
}

/** "SE16 1AA, London", or whichever part is known. */
export function deliveryPlace(order: Pick<DeliveryOrder, "postcode" | "city">): string | null {
  const parts = [order.postcode, order.city].filter(Boolean)
  return parts.length ? parts.join(", ") : null
}
