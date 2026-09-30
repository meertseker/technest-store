import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { runEmail } from "../lib/email/run-email"

/** order.return_received → "We've received your return". */
export default async function returnReceivedEmail({
  event: { data },
  container,
}: SubscriberArgs<{ order_id: string; return_id: string }>) {
  await runEmail(container, {
    template: "return-received",
    recipient: "customer",
    resource_id: data.return_id,
    resource_type: "return",
    trigger_type: "order.return_received",
  })
}

export const config: SubscriberConfig = { event: "order.return_received" }
