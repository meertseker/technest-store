/** Plain-English order status for the account pages (pure, unit tested) */

export type OrderStatusTone = "neutral" | "success" | "warning"
export type OrderStatusView = { label: string; tone: OrderStatusTone; detail: string }

type OrderLike = {
  status?: string | null
  fulfillment_status?: string | null
  payment_status?: string | null
  shipping_methods?: { name?: string | null }[] | null
}

/** Click & Collect is a GBP 0 shipping option on the shop's location (CLAUDE.md) */
export const isClickAndCollect = (order: OrderLike) =>
  (order.shipping_methods ?? []).some((m) => /collect/i.test(m?.name ?? ""))

export function orderStatus(order: OrderLike): OrderStatusView {
  const f = order.fulfillment_status ?? ""
  const collect = isClickAndCollect(order)

  if (order.status === "canceled" || f === "canceled") {
    return { label: "Cancelled", tone: "neutral", detail: "This order was cancelled. Any payment hold has been released." }
  }
  if (collect) {
    if (order.payment_status === "captured" || f === "delivered") {
      return { label: "Collected", tone: "success", detail: "You collected this order from the shop." }
    }
    if (f === "fulfilled" || f === "partially_fulfilled") {
      return { label: "Ready to collect", tone: "success", detail: "Your order is waiting for you at the shop." }
    }
    return { label: "Preparing", tone: "neutral", detail: "We are getting your order ready. We will email you when you can collect it." }
  }
  if (f === "delivered" || f === "partially_delivered") {
    return { label: "Delivered", tone: "success", detail: "Your order has been delivered." }
  }
  if (f === "shipped" || f === "partially_shipped") {
    return { label: "On its way", tone: "neutral", detail: "Your order has left the shop and is on its way." }
  }
  if (order.status === "requires_action") {
    return { label: "Needs attention", tone: "warning", detail: "Please call the shop about this order." }
  }
  return { label: "Order placed", tone: "neutral", detail: "We have your order and are getting it ready." }
}

/** Medusa prices and totals are major units (GBP 3.49 = 3.49): never divide by 100 */
export function formatMoney(amount: number | null | undefined, currency = "gbp") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(amount ?? 0)
}

export function formatOrderDate(iso: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(iso))
}
