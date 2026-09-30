import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { runEmail } from "../lib/email/run-email"
import { londonDay, MAX_DIGEST_VARIANTS } from "../lib/email/trade-sources"

export const LOW_STOCK_EVENT = "technest.inventory.low_stock"

/** Payload of technest.inventory.low_stock (docs/contracts/emails.md). */
export type LowStockEvent = {
  items: {
    variant_id: string
    sku: string | null
    title: string
    stocked_quantity: number
    threshold: number
  }[]
}

/**
 * technest.inventory.low_stock (the daily low-stock job) → one "Low stock"
 * digest to the shop per shop day; nothing when the list is empty. A second
 * event on the same day (e.g. a manual re-run) sends nothing more.
 *
 * Only the variant ids go into the (persisted) workflow input; the email
 * reloads titles, SKUs and stock, so a retry shows current numbers.
 */
export default async function lowStockDigestEmail({
  event: { name, data },
  container,
}: SubscriberArgs<Partial<LowStockEvent> | undefined>) {
  const items: unknown[] = Array.isArray(data?.items) ? data.items : []
  const ids = [
    ...new Set(
      items
        .map((i) => (i && typeof i === "object" ? (i as { variant_id?: unknown }).variant_id : undefined))
        .filter((id): id is string => typeof id === "string" && !!id)
    ),
  ]
  if (!ids.length) return
  await runEmail(container, {
    template: "shop-low-stock-digest",
    recipient: "shop",
    resource_id: `low_stock_${londonDay()}`,
    resource_type: "low_stock_digest",
    trigger_type: name,
    ids: ids.slice(0, MAX_DIGEST_VARIANTS),
  })
}

export const config: SubscriberConfig = { event: LOW_STOCK_EVENT }
