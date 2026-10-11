// Shapes of docs/contracts/delivery-orders.md, as the admin UI reads them.

export type DeliveryStatus = "to_pack" | "shipped"
export type DeliveryPaymentStatus = "paid" | "not_taken" | "refunded"

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
  /** Some of the order has left, the rest is still to pack. */
  partly_shipped: boolean
  /** "not_taken" and "refunded" orders can't be marked shipped. */
  payment_status: DeliveryPaymentStatus
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

export type PaymentBadge = { label: string; color: "red" | "grey" }

/** A badge in words (never colour alone) when the money is not in; nothing when paid. */
export function paymentBadge(order: Pick<DeliveryOrder, "payment_status">): PaymentBadge | null {
  if (order.payment_status === "not_taken") return { label: "Payment not taken", color: "red" }
  if (order.payment_status === "refunded") return { label: "Refunded", color: "grey" }
  return null
}

/**
 * Why "Packed & shipped" is switched off, in the words the server would refuse
 * with, so the shop knows before the press. Null when the order can ship.
 */
export function shipBlocker(order: Pick<DeliveryOrder, "payment_status">): string | null {
  if (order.payment_status === "not_taken") {
    return "The payment hasn't been taken yet, so this can't be sent. Open the order and take the payment first (or wait: the shop retries on its own)."
  }
  if (order.payment_status === "refunded") {
    return "This order was refunded in full, so there is nothing to send."
  }
  return null
}

export type TrackingBody = { tracking_number?: string; tracking_url?: string }

/** What the server accepts (docs/contracts/delivery-orders.md): letters, digits, spaces, dashes. */
export const TRACKING_NUMBER_RE = /^[A-Za-z0-9 -]{1,64}$/
export const TRACKING_URL_MAX = 500

/**
 * The optional tracking fields of the "Packed & shipped" dialog, checked the way
 * the server checks them so the shop hears about a slip before the press.
 */
export function trackingInput(
  number: string,
  url: string
): { ok: true; body: TrackingBody } | { ok: false; error: string } {
  const n = number.trim()
  const u = url.trim()
  if (!n && !u) return { ok: true, body: {} }
  if (!n) return { ok: false, error: "Add the tracking number as well, or clear the link." }
  if (!TRACKING_NUMBER_RE.test(n)) {
    return { ok: false, error: "A tracking number has only letters, numbers, spaces and dashes (up to 64)." }
  }
  if (u && !(/^https?:\/\//i.test(u) && u.length <= TRACKING_URL_MAX)) {
    return { ok: false, error: "The tracking link must start with https:// and be under 500 characters." }
  }
  return { ok: true, body: u ? { tracking_number: n, tracking_url: u } : { tracking_number: n } }
}
