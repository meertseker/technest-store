import { endOfLondonDay } from "../click-collect/deadline"

// The shop panel's Sales page (GET /admin/shop-dashboard): orders, money and
// best sellers per London day. Medusa amounts are major units (3.49 = £3.49);
// everything returned is integer pence.

export const DASHBOARD_DAYS = [1, 7, 30, 90] as const
export type DashboardDays = (typeof DASHBOARD_DAYS)[number]

const HOUR_MS = 60 * 60 * 1000

const londonDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** "2026-10-23": the London calendar date of an instant. */
export function londonDate(instant: number): string {
  return londonDay.format(new Date(instant))
}

/** London midnight that starts the day containing `instant` (days are 23 to 25 hours long). */
export function startOfLondonDay(instant: number): number {
  return endOfLondonDay(endOfLondonDay(instant) - 26 * HOUR_MS) + 1
}

export type Period = {
  /** Start of the first day shown (London midnight). */
  from: number
  to: number
  /** The same number of days just before `from`, for "compared with". */
  previous_from: number
  /** One London date per day shown, oldest first. */
  dates: string[]
}

/** The last `days` London days up to `now`, today included. */
export function periodFor(days: number, now: number): Period {
  const starts = [startOfLondonDay(now)]
  for (let i = 1; i < days * 2; i++) starts.unshift(startOfLondonDay(starts[0] - 1))
  return {
    from: starts[days],
    to: now,
    previous_from: starts[0],
    dates: starts.slice(days).map(londonDate),
  }
}

export type DashboardOrderRow = {
  id: string
  created_at: string | Date
  status?: string | null
  total?: unknown
  original_total?: unknown
  items?:
    | ({ product_id?: string | null; product_title?: string | null; title?: string | null; quantity?: unknown; total?: unknown } | null)[]
    | null
  payment_collections?: ({ payments?: ({ refunds?: ({ amount?: unknown } | null)[] | null } | null)[] | null } | null)[] | null
}

export const DASHBOARD_ORDER_FIELDS = [
  "id",
  "created_at",
  "status",
  "total",
  "original_total",
  "items.product_id",
  "items.product_title",
  "items.title",
  "items.quantity",
  "items.total",
  "payment_collections.payments.refunds.amount",
]

export const pence = (major: unknown): number => {
  const n = typeof major === "number" ? major : Number(major ?? 0)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export type SalesSummary = {
  /** What customers paid for the period's orders, less what was refunded on them. */
  sales_pence: number
  orders: number
  /** Order value before refunds, per order. */
  average_order_pence: number
  refunds_pence: number
}

export type DailySales = { date: string; sales_pence: number; orders: number }
export type TopProduct = { title: string; quantity: number; sales_pence: number }

const counted = (o: DashboardOrderRow) => o.status !== "canceled"

function refundsOf(o: DashboardOrderRow): number {
  let total = 0
  for (const pc of o.payment_collections ?? [])
    for (const p of pc?.payments ?? []) for (const r of p?.refunds ?? []) total += pence(r?.amount)
  return total
}

const grossOf = (o: DashboardOrderRow) => pence(o.original_total ?? o.total)

export function summarise(orders: DashboardOrderRow[]): SalesSummary {
  const kept = orders.filter(counted)
  const gross = kept.reduce((t, o) => t + grossOf(o), 0)
  const refunds = kept.reduce((t, o) => t + refundsOf(o), 0)
  return {
    sales_pence: gross - refunds,
    orders: kept.length,
    average_order_pence: kept.length ? Math.round(gross / kept.length) : 0,
    refunds_pence: refunds,
  }
}

export function dailySales(orders: DashboardOrderRow[], dates: string[]): DailySales[] {
  const byDate = new Map(dates.map((date) => [date, { date, sales_pence: 0, orders: 0 }]))
  for (const o of orders.filter(counted)) {
    const day = byDate.get(londonDate(new Date(o.created_at).getTime()))
    if (!day) continue
    day.orders += 1
    day.sales_pence += grossOf(o) - refundsOf(o)
  }
  return [...byDate.values()]
}

/** Best sellers by units sold, then by money. */
export function topProducts(orders: DashboardOrderRow[], limit = 5): TopProduct[] {
  const byProduct = new Map<string, TopProduct>()
  for (const o of orders.filter(counted)) {
    for (const item of o.items ?? []) {
      if (!item) continue
      const title = item.product_title || item.title || "Unnamed product"
      const key = item.product_id || title
      const row = byProduct.get(key) ?? { title, quantity: 0, sales_pence: 0 }
      row.quantity += Number(item.quantity ?? 0) || 0
      row.sales_pence += pence(item.total)
      byProduct.set(key, row)
    }
  }
  return [...byProduct.values()]
    .sort((a, b) => b.quantity - a.quantity || b.sales_pence - a.sales_pence)
    .slice(0, limit)
}
