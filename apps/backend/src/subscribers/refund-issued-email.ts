import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { runEmail } from "../lib/email/run-email"

// Only refunds this recent are emailed, so an old refund whose email once
// failed for good is never sent out of the blue months later.
const RECENT_MS = 24 * 60 * 60 * 1000

/**
 * payment.refunded → "Refund issued", one email per refund. The event only
 * carries the payment id and a payment can be refunded several times
 * (partial refunds), so every recent refund of it is sent; refunds already
 * emailed are skipped by the send-once check.
 */
export default async function refundIssuedEmail({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: payments } = await query.graph({
    entity: "payment",
    fields: ["id", "refunds.id", "refunds.created_at"],
    filters: { id: data.id },
  })
  const since = Date.now() - RECENT_MS
  const refunds = (payments[0]?.refunds ?? []).filter(
    (r) => r && new Date(r.created_at as unknown as string).getTime() >= since
  )
  for (const refund of refunds) {
    await runEmail(container, {
      template: "refund-issued",
      recipient: "customer",
      resource_id: refund!.id,
      resource_type: "refund",
      trigger_type: "payment.refunded",
    })
  }
}

export const config: SubscriberConfig = { event: "payment.refunded" }
