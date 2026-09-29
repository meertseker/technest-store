import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { loadOrderEmailData, shopNotifyEmail } from "../lib/email/order-email-data"
import { sendEmailWorkflow } from "../workflows/send-email"

/** order.placed → customer "Order confirmed" + shop "New order" alert. */
export default async function orderPlacedEmails({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { email, data: order } = await loadOrderEmailData(container, data.id)

  const sends = [
    { to: email, template: "order-confirmation" },
    { to: shopNotifyEmail(), template: "shop-new-order" },
  ]
  for (const send of sends) {
    try {
      await sendEmailWorkflow(container).run({
        input: {
          ...send,
          data: order as unknown as Record<string, unknown>,
          idempotency_key: `${send.template}:${data.id}`,
          resource_id: data.id,
          resource_type: "order",
          trigger_type: "order.placed",
        },
      })
    } catch (e) {
      // IDs only in logs: never the address or the order contents.
      logger.error(`order.placed email ${send.template} failed for ${data.id}: ${(e as Error).message}`)
    }
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
