import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { reportingSubscriber } from "../lib/alerting"
import { runEmail } from "../lib/email/run-email"

/** order.placed → customer "Order confirmed" + shop "New order" alert. */
async function orderPlacedEmails({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  // Independent sends (runEmail never throws): an order without a customer
  // email, or whose confirmation fails, still alerts the shop.
  for (const send of [
    { template: "order-confirmation", recipient: "customer" },
    { template: "shop-new-order", recipient: "shop" },
  ] as const) {
    await runEmail(container, { ...send, resource_id: data.id, resource_type: "order", trigger_type: "order.placed" })
  }
}

export default reportingSubscriber("order-placed-emails", orderPlacedEmails)

export const config: SubscriberConfig = {
  event: "order.placed",
}
