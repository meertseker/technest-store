/**
 * Delivery box copy for the product page (docs/specs/design.md 7.3; CLAUDE.md
 * "no drip pricing": delivery cost is shown before the basket).
 *
 * Our own amounts are integer pence. The free-delivery threshold comes from
 * GET /store/technest-settings (docs/contracts/settings.md); when that route
 * is missing or down we fall back to the contract default, 2000 pence.
 *
 * Medusa only prices shipping options for an existing cart, so the product
 * page can't ask for them. The Standard and Next-day prices below mirror the
 * seed (apps/backend/src/scripts/seed/data.ts, placeholders the lead will
 * confirm) and must be kept in step with the shipping options in the admin.
 */
import type { TechnestSettings } from "@lib/data/technest-settings"
import { formatGbp } from "@/lib/home/select"

/** 2000 -> "£20", 349 -> "£3.49" */
const formatPence = (pence: number) => formatGbp(pence / 100)

export const DEFAULT_FREE_DELIVERY_THRESHOLD_PENCE = 2000
export const STANDARD_DELIVERY_PENCE = 349
export const NEXT_DAY_DELIVERY_PENCE = 599

export type DeliveryLine = { id: "collect" | "standard" | "next-day"; title: string; detail: string }

export function freeDeliveryThresholdPence(settings: TechnestSettings | null): number {
  return settings?.free_delivery_threshold_pence ?? DEFAULT_FREE_DELIVERY_THRESHOLD_PENCE
}

/**
 * @param closesToday "8pm" when the shop is open later today, else null
 * @param itemPricePence the chosen item's price, to say when this item alone
 *   already qualifies for free delivery
 */
export function deliveryLines(opts: {
  thresholdPence: number
  closesToday: string | null
  itemPricePence?: number | null
}): DeliveryLine[] {
  const { thresholdPence, closesToday, itemPricePence } = opts
  const freeAlone = itemPricePence != null && itemPricePence >= thresholdPence
  const standardDetail =
    thresholdPence === 0
      ? "Free."
      : freeAlone
        ? `Free with this item (orders of ${formatPence(thresholdPence)} or more).`
        : `${formatPence(STANDARD_DELIVERY_PENCE)}, free on orders of ${formatPence(thresholdPence)} or more.`
  return [
    {
      id: "collect",
      title: "Click & Collect: free",
      detail: closesToday
        ? `Collect from our shop on Southwark Park Road. Open today until ${closesToday}.`
        : "Collect from our shop on Southwark Park Road. We email you when it's ready.",
    },
    { id: "standard", title: "Standard delivery", detail: standardDetail },
    {
      id: "next-day",
      title: "Next-day delivery",
      detail: `${formatPence(NEXT_DAY_DELIVERY_PENCE)}. Next working day.`,
    },
  ]
}

/** Major units (Medusa price) to integer pence, rounding away float noise: 9.99 -> 999 */
export const toPence = (major: number) => Math.round(major * 100)
