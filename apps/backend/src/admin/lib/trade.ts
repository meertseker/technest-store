// Trade applications as the admin acts on them (docs/contracts/trade.md).
// Pure functions and a thin call, so the pages stay small and this is testable.

import type { TradeApplication, TradeApplicationStatus } from "./types"

/** The server keeps at most this many characters of a closing reason. */
export const REVOKE_REASON_MAX = 500

export type TradeAction = "approve" | "reject" | "revoke"

/** What the shop can do with an application in this state. Closed and rejected ones: nothing. */
export function tradeActions(status: TradeApplicationStatus): TradeAction[] {
  if (status === "pending") return ["approve", "reject"]
  if (status === "approved") return ["revoke"]
  return []
}

/** `{ reason }` trimmed and clipped, or `{}` when nothing was written. */
export function revokeBody(reason: string): { reason?: string } {
  const text = reason.trim().slice(0, REVOKE_REASON_MAX)
  return text ? { reason: text } : {}
}

export type TradeApplicationResponse = { trade_application: TradeApplication }

type Fetch = <T>(path: string, init: { method: "POST"; body: Record<string, unknown> }) => Promise<T>

/**
 * Closes an approved trade account: the customer leaves the Trade group, pays
 * retail from now on, is emailed (with the reason when there is one) and may
 * apply again. `fetch` is `sdk.client.fetch`.
 */
export function revokeTradeApplication(fetch: Fetch, id: string, reason: string) {
  return fetch<TradeApplicationResponse>(`/admin/trade-applications/${id}/revoke`, {
    method: "POST",
    body: revokeBody(reason),
  })
}
