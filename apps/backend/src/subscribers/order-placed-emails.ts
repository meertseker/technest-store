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

  let loaded: Awaited<ReturnType<typeof loadOrderEmailData>>
  try {
    loaded = await loadOrderEmailData(container, data.id)
  } catch (e) {
    logger.error(`order.placed emails: could not load order ${data.id}: ${(e as Error).message}`)
    return
  }

  // Each send is independent: a missing customer email must not stop the shop alert.
  const sends = [
    ...(loaded.email ? [{ to: loaded.email, template: "order-confirmation" }] : []),
    { to: shopNotifyEmail(), template: "shop-new-order" },
  ]
  for (const send of sends) {
    try {
      await sendEmailWorkflow(container).run({
        input: {
          ...send,
          data: loaded.data as unknown as Record<string, unknown>,
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
