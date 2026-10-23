// Visitors for the Sales page, from Cloudflare's own count of the shop's
// traffic (the zone sits in front of the site): no script on the shop, no
// cookie, nothing to consent to. A "visitor" is a unique IP per day, so a
// few bots are in it. Cloudflare's days are UTC days; at most an hour off
// the London day, which is fine for a daily chart.
//
// Read-only token: CLOUDFLARE_ANALYTICS_TOKEN (Analytics Read on the zone),
// CLOUDFLARE_ZONE_ID. Without them the page shows sales only.

export type DailyVisitors = { date: string; visitors: number; page_views: number }

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
}>

const ENDPOINT = "https://api.cloudflare.com/client/v4/graphql"
const CACHE_MS = 10 * 60 * 1000
const cache = new Map<string, { at: number; rows: DailyVisitors[] }>()

export function visitorsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!env.CLOUDFLARE_ANALYTICS_TOKEN?.trim() && !!env.CLOUDFLARE_ZONE_ID?.trim()
}

/** Clears the 10-minute cache (tests). */
export function clearVisitorCache() {
  cache.clear()
}

/**
 * Daily visitors from `from` to `to` (YYYY-MM-DD, inclusive). Null when not
 * configured or Cloudflare can't be reached in time: the page then says so.
 */
export async function fetchDailyVisitors(
  from: string,
  to: string,
  opts: { env?: NodeJS.ProcessEnv; fetchImpl?: Fetch; timeoutMs?: number; now?: number } = {}
): Promise<DailyVisitors[] | null> {
  const env = opts.env ?? process.env
  if (!visitorsConfigured(env)) return null
  const zone = env.CLOUDFLARE_ZONE_ID!.trim()
  const key = `${zone}|${from}|${to}`
  const now = opts.now ?? Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.at < CACHE_MS) return hit.rows

  if (!/^[0-9a-f]{32}$/i.test(zone) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null
  const query = `{ viewer { zones(filter: { zoneTag: "${zone}" }) { httpRequests1dGroups(limit: 400, filter: { date_geq: "${from}", date_leq: "${to}" }, orderBy: [date_ASC]) { dimensions { date } sum { pageViews } uniq { uniques } } } } }`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000)
  try {
    const res = await (opts.fetchImpl ?? (fetch as unknown as Fetch))(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_TOKEN!.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const body = (await res.json()) as {
      data?: { viewer?: { zones?: { httpRequests1dGroups?: { dimensions?: { date?: string }; sum?: { pageViews?: number }; uniq?: { uniques?: number } }[] }[] } } | null
      errors?: unknown[] | null
    }
    if (body.errors?.length) return null
    const groups = body.data?.viewer?.zones?.[0]?.httpRequests1dGroups
    if (!Array.isArray(groups)) return null
    const rows = groups
      .filter((g) => typeof g.dimensions?.date === "string")
      .map((g) => ({ date: g.dimensions!.date!, visitors: Number(g.uniq?.uniques ?? 0) || 0, page_views: Number(g.sum?.pageViews ?? 0) || 0 }))
    cache.set(key, { at: now, rows })
    return rows
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
