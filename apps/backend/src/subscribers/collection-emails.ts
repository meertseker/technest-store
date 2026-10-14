import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { reportingSubscriber } from "../lib/alerting"
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
async function collectionEmails({
  event: { name, data },
  container,
}: SubscriberArgs<{ order_id: string; resend?: boolean; send_key?: string }>) {
  const template = TEMPLATES[name]
  if (!template || !data?.order_id) return
  // A resend from the board is a new email; a redelivered event is not.
  const sendKey = data.resend === true && typeof data.send_key === "string" && data.send_key ? data.send_key : undefined
  await runEmail(container, {
    template,
    recipient: "customer",
    resource_id: data.order_id,
    resource_type: "order",
    trigger_type: name,
    ...(sendKey ? { send_key: sendKey } : {}),
  })
}

export default reportingSubscriber("collection-emails", collectionEmails)

export const config: SubscriberConfig = { event: Object.keys(TEMPLATES) }
