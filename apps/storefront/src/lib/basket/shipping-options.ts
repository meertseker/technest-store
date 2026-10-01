/**
 * Groups the cart's shipping options (GET /store/shipping-options?cart_id=)
 * into the three choices the spec shows: Collect from shop | Standard | Next-day.
 * Prices always come from Medusa (`amount`, major units); nothing is hardcoded.
 *
 * Detection: Click & Collect lives in the `pickup` fulfillment set (E2's
 * click-collect contract); the others use the shipping option type code
 * seeded by E1 (`standard`, `next-day`), with the name as a fallback.
 */
import { toPence } from "./money"

export type ShippingOptionLike = {
  id: string
  name: string
  amount?: number | null
  calculated_price?: { calculated_amount?: number | null } | null
  insufficient_inventory?: boolean
  type?: { code?: string | null; label?: string | null; description?: string | null } | null
  service_zone?: { fulfillment_set?: { type?: string | null } | null } | null
}

export type DeliveryKind = "collect" | "standard" | "next-day"

export type DeliveryChoice = {
  kind: DeliveryKind
  id: string
  name: string
  description: string | null
  /** major units, straight from Medusa */
  amount: number
  amount_pence: number
  available: boolean
}

export function optionAmount(o: ShippingOptionLike): number {
  const a = o.calculated_price?.calculated_amount ?? o.amount
  return typeof a === "number" && Number.isFinite(a) ? a : 0
}

export function deliveryKind(o: ShippingOptionLike): DeliveryKind | null {
  if (o.service_zone?.fulfillment_set?.type === "pickup") return "collect"
  const code = o.type?.code?.toLowerCase() ?? ""
  if (code === "click-collect") return "collect"
  if (code === "next-day") return "next-day"
  if (code === "standard") return "standard"
  const name = o.name.toLowerCase()
  if (/collect/.test(name)) return "collect"
  if (/next[\s-]?day/.test(name)) return "next-day"
  if (/standard/.test(name)) return "standard"
  return null
}

const ORDER: DeliveryKind[] = ["collect", "standard", "next-day"]

/** One choice per kind (cheapest wins if several), in spec order */
export function groupDeliveryChoices(
  options: readonly ShippingOptionLike[] | null | undefined
): DeliveryChoice[] {
  const byKind = new Map<DeliveryKind, DeliveryChoice>()
  for (const o of options ?? []) {
    const kind = deliveryKind(o)
    if (!kind) continue
    const amount = optionAmount(o)
    const choice: DeliveryChoice = {
      kind,
      id: o.id,
      name: o.name,
      description: o.type?.description ?? null,
      amount,
      amount_pence: toPence(amount),
      available: !o.insufficient_inventory,
    }
    const prev = byKind.get(kind)
    if (!prev || choice.amount_pence < prev.amount_pence) byKind.set(kind, choice)
  }
  return ORDER.flatMap((k) => (byKind.has(k) ? [byKind.get(k)!] : []))
}

/** Cheapest home-delivery price in pence (for "Delivery from £X"), or null if none */
export function cheapestDeliveryPence(choices: readonly DeliveryChoice[]): number | null {
  const delivery = choices.filter((c) => c.kind !== "collect" && c.available)
  if (!delivery.length) return null
  return Math.min(...delivery.map((c) => c.amount_pence))
}

/**
 * The option's description as shown under its name. The price column already
 * says "Free" for a free option, so a description that opens with "Free." is
 * trimmed rather than saying it twice.
 */
export function choiceDescription(c: Pick<DeliveryChoice, "description" | "amount_pence">): string | null {
  const text = c.description?.trim() ?? ""
  const rest = c.amount_pence === 0 ? text.replace(/^free[.,:]?(\s+|$)/i, "") : text
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null
}

export const DELIVERY_LABEL: Record<DeliveryKind, string> = {
  collect: "Collect from shop",
  standard: "Standard delivery",
  "next-day": "Next-day delivery",
}
