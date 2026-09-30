import "server-only"
import { sdk } from "@lib/config"
import { FetchError } from "@medusajs/js-sdk"
import { parseTradeTiers } from "@/lib/trade/format"
import type { TradeApplication, TradeTiersResponse } from "@/lib/trade/types"
import { getAuthHeaders } from "./cookies"

/**
 * GET /store/trade-applications/me (docs/contracts/trade.md).
 * undefined = not signed in or the backend failed (the caller must not claim
 * "you have not applied"); null = signed in and never applied.
 */
export async function getMyTradeApplication(): Promise<TradeApplication | null | undefined> {
  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) return undefined
  try {
    const { trade_application } = await sdk.client.fetch<{ trade_application: TradeApplication | null }>(
      "/store/trade-applications/me",
      { method: "GET", headers, cache: "no-store" }
    )
    return trade_application
  } catch {
    return undefined
  }
}

/**
 * GET /store/products/:id/trade-tiers. Personal (per customer group), so never
 * cached. null for guests, non-trade customers (403), missing products (404)
 * or any error: the product page then simply shows retail prices.
 */
export async function getTradeTiers(productId: string): Promise<TradeTiersResponse | null> {
  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) return null
  try {
    const body = await sdk.client.fetch<unknown>(
      `/store/products/${encodeURIComponent(productId)}/trade-tiers`,
      { method: "GET", headers, cache: "no-store" }
    )
    return parseTradeTiers(body)
  } catch (e) {
    const status = (e as FetchError)?.status
    if (status && status !== 401 && status !== 403 && status !== 404) {
      console.warn(`trade-tiers: unexpected status ${status}`)
    }
    return null
  }
}
