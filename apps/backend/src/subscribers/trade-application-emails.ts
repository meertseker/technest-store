import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { EmailRecipient } from "../lib/email/sources"
import { runEmail } from "../lib/email/run-email"

/** Event → emails (docs/contracts/emails.md rows 12–14; events from docs/contracts/trade.md). */
export const TRADE_EMAILS: Record<string, { template: string; recipient: EmailRecipient }[]> = {
  "technest.trade_application.created": [
    { template: "trade-application-received", recipient: "customer" },
    { template: "shop-trade-application", recipient: "shop" },
  ],
  "technest.trade_application.approved": [{ template: "trade-application-approved", recipient: "customer" }],
  "technest.trade_application.rejected": [{ template: "trade-application-rejected", recipient: "customer" }],
}

/**
 * Trade application emails. Payloads are `{ id, customer_id, reason? }`; only
 * the id is used: the application (and its rejection reason) is loaded fresh
 * on every attempt, and the customer email is the account's own address.
 */
export default async function tradeApplicationEmails({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string; customer_id?: string; reason?: string }>) {
  const sends = TRADE_EMAILS[name]
  if (!sends || typeof data?.id !== "string" || !data.id) return
  // Independent sends: a customer email failure still alerts the shop.
  for (const send of sends) {
    await runEmail(container, {
      ...send,
      resource_id: data.id,
      resource_type: "trade_application",
      trigger_type: name,
    })
  }
}

export const config: SubscriberConfig = { event: Object.keys(TRADE_EMAILS) }
