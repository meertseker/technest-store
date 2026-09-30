import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { runEmail } from "../lib/email/run-email"

/**
 * technest.payment.capture_failed (emitted by the order.placed capture, C3)
 * → "We couldn't take payment" to the customer and a "don't ship" copy to the shop.
 */
export default async function paymentFailedEmail({
  event: { name, data },
  container,
}: SubscriberArgs<{ order_id: string }>) {
  if (!data?.order_id) return
  for (const recipient of ["customer", "shop"] as const) {
    await runEmail(container, {
      template: "payment-failed",
      recipient,
      resource_id: data.order_id,
      resource_type: "order",
      trigger_type: name,
    })
  }
}

export const config: SubscriberConfig = { event: "technest.payment.capture_failed" }
