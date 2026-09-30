import { sdk } from "@lib/config"

/** docs/contracts/settings.md v1. All amounts are integer pence (GBP, VAT included). */
export type TechnestSettings = {
  free_delivery_threshold_pence: number
  klarna_min_basket_pence: number
}

const isPence = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0

/** Validates the store route's body; anything unexpected becomes null */
export function parseSettings(body: unknown): TechnestSettings | null {
  const s = (body as { settings?: Record<string, unknown> } | null)?.settings
  if (!s || !isPence(s.free_delivery_threshold_pence) || !isPence(s.klarna_min_basket_pence)) {
    return null
  }
  return {
    free_delivery_threshold_pence: s.free_delivery_threshold_pence,
    klarna_min_basket_pence: s.klarna_min_basket_pence,
  }
}

/**
 * GET /store/technest-settings, cached 60 s (the contract says that is safe).
 * Returns null when the backend is down or the route is missing, so callers
 * must word their copy without the number in that case.
 */
export async function getTechnestSettings(): Promise<TechnestSettings | null> {
  try {
    const body = await sdk.client.fetch<unknown>("/store/technest-settings", {
      next: { revalidate: 60 },
    })
    return parseSettings(body)
  } catch {
    return null
  }
}

/** 2000 -> "£20", 2050 -> "£20.50" */
export function formatPence(pence: number) {
  const pounds = pence / 100
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number.isInteger(pounds) ? 0 : 2,
  }).format(pounds)
}
