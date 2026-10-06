import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { reportingSubscriber } from "../lib/alerting"
import { runEmail } from "../lib/email/run-email"

/** customer.created → "Welcome" (registered customers only; see lib/email/sources). */
async function customerWelcome({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await runEmail(container, {
    template: "welcome",
    recipient: "customer",
    resource_id: data.id,
    resource_type: "customer",
    trigger_type: "customer.created",
  })
}

export default reportingSubscriber("customer-welcome", customerWelcome)

export const config: SubscriberConfig = {
  event: "customer.created",
}
