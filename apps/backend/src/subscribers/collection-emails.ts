import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { runEmail } from "../lib/email/run-email"

const TEMPLATES: Record<string, string> = {
  "technest.order.ready_for_collection": "ready-for-collection",
  "technest.order.collection_reminder": "collection-reminder",
}

/**
 * Click & Collect: "Ready for collection" (staff pressed the button on the
 * board) and the day-3 reminder. Both events are emitted by the collection
 * workflows/job (C3) with { order_id }.
 */
export default async function collectionEmails({
  event: { name, data },
  container,
}: SubscriberArgs<{ order_id: string }>) {
  const template = TEMPLATES[name]
  if (!template || !data?.order_id) return
  await runEmail(container, {
    template,
    recipient: "customer",
    resource_id: data.order_id,
    resource_type: "order",
    trigger_type: name,
  })
}

export const config: SubscriberConfig = { event: Object.keys(TEMPLATES) }
