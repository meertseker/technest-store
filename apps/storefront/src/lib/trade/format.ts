import type { TradeApplicationStatus, TradeTier, TradeTiersResponse } from "./types"

/** 625 -> "£6.25" (pence in, always two decimals: this is a unit price) */
export function formatUnitPence(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100)
}

/** {1,9} -> "1 to 9", {50,null} -> "50 or more", {1,1} -> "1" */
export function tierRange(t: Pick<TradeTier, "min_quantity" | "max_quantity">) {
  if (t.max_quantity === null) return `${t.min_quantity} or more`
  if (t.max_quantity === t.min_quantity) return `${t.min_quantity}`
  return `${t.min_quantity} to ${t.max_quantity}`
}

/** Percentage saved against retail (both VAT-inclusive), rounded down; null if not a saving */
export function savingPercent(retailIncVatPence: number | null, tierIncVatPence: number) {
  if (!retailIncVatPence || tierIncVatPence >= retailIncVatPence) return null
  return Math.floor(((retailIncVatPence - tierIncVatPence) / retailIncVatPence) * 100)
}

/**
 * Validates the route's body. Anything unexpected is null, so a contract
 * change hides the table instead of showing wrong prices.
 */
export function parseTradeTiers(body: unknown): TradeTiersResponse | null {
  const b = body as Partial<TradeTiersResponse> | null
  if (!b || typeof b !== "object" || !Array.isArray(b.variants) || typeof b.product_id !== "string") return null
  const int = (n: unknown) => Number.isInteger(n) && (n as number) >= 0
  for (const v of b.variants) {
    if (!v || typeof v.variant_id !== "string" || !Array.isArray(v.tiers)) return null
    if (v.retail_inc_vat_pence !== null && !int(v.retail_inc_vat_pence)) return null
    for (const t of v.tiers) {
      if (!int(t.min_quantity) || !(t.max_quantity === null || int(t.max_quantity))) return null
      if (!int(t.unit_price_ex_vat_pence) || !int(t.unit_price_inc_vat_pence)) return null
    }
  }
  return {
    product_id: b.product_id,
    currency_code: typeof b.currency_code === "string" ? b.currency_code : "gbp",
    price_label: typeof b.price_label === "string" && b.price_label ? b.price_label : "ex VAT",
    vat_rate_percent: typeof b.vat_rate_percent === "number" ? b.vat_rate_percent : 20,
    variants: b.variants.map((v) => ({ ...v, tiers: [...v.tiers].sort((x, y) => x.min_quantity - y.min_quantity) })),
  }
}

export const TRADE_STATUS_COPY: Record<
  TradeApplicationStatus,
  { label: string; tone: "neutral" | "success" | "warning"; title: string; body: string }
> = {
  pending: {
    label: "Pending",
    tone: "neutral",
    title: "We are checking your application",
    body: "A member of the team checks every application by hand. We will email you when we have made a decision.",
  },
  approved: {
    label: "Approved",
    tone: "success",
    title: "Your trade account is active",
    body: "Sign in and you will see trade prices, ex VAT, on products that have them. Your basket charges the trade price.",
  },
  rejected: {
    label: "Not approved",
    tone: "warning",
    title: "We could not approve your application",
    body: "You can apply again with updated details, or call the shop to talk it through.",
  },
}
