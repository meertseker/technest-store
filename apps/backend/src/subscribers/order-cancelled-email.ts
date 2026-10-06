import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { reportingSubscriber } from "../lib/alerting"
import { runEmail } from "../lib/email/run-email"

/** order.canceled → "Order cancelled" (also sent by the day-7 Click & Collect auto-cancel). */
async function orderCancelledEmail({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await runEmail(container, {
    template: "order-cancelled",
    recipient: "customer",
    resource_id: data.id,
    resource_type: "order",
    trigger_type: "order.canceled",
  })
}

export default reportingSubscriber("order-cancelled-email", orderCancelledEmail)

export const config: SubscriberConfig = { event: "order.canceled" }
