import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { EmailRecipient } from "../lib/email/sources"
import { sendEmailWorkflow } from "../workflows/send-email"

/** order.placed → customer "Order confirmed" + shop "New order" alert. */
export default async function orderPlacedEmails({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const sends: { template: string; recipient: EmailRecipient }[] = [
    { template: "order-confirmation", recipient: "customer" },
    { template: "shop-new-order", recipient: "shop" },
  ]
  // Independent sends: an order without a customer email still alerts the shop.
  for (const send of sends) {
    try {
      await sendEmailWorkflow(container).run({
        input: { ...send, resource_id: data.id, resource_type: "order", trigger_type: "order.placed" },
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
