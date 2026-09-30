import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { runEmail } from "../lib/email/run-email"

/** shipment.created → "On its way" (id is the fulfillment id). */
export default async function orderDispatchedEmail({
  event: { data },
  container,
}: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  if (data.no_notification) return
  await runEmail(container, {
    template: "order-dispatched",
    recipient: "customer",
    resource_id: data.id,
    resource_type: "fulfillment",
    trigger_type: "shipment.created",
  })
}

export const config: SubscriberConfig = { event: "shipment.created" }
