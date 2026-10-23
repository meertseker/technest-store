import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  DASHBOARD_ORDER_FIELDS,
  type DashboardOrderRow,
  dailySales,
  londonDate,
  periodFor,
  summarise,
  topProducts,
} from "../../../lib/dashboard/sales"
import { fetchDailyVisitors, visitorsConfigured } from "../../../lib/dashboard/visitors"
import type { AdminGetShopDashboardParams } from "./middlewares"

const PAGE = 500

/**
 * The shop panel's Sales page: sales, orders, average order, refunds and
 * visitors for the last `days` London days, the same numbers for the days just
 * before, a daily series and the best sellers. Read only.
 */
export async function GET(req: AuthenticatedMedusaRequest<unknown, AdminGetShopDashboardParams>, res: MedusaResponse) {
  const { days } = req.validatedQuery
  const period = periodFor(days, Date.now())
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const rows: DashboardOrderRow[] = []
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "order",
      fields: DASHBOARD_ORDER_FIELDS,
      filters: { created_at: { $gte: new Date(period.previous_from) } },
      pagination: { skip, take: PAGE, order: { created_at: "ASC" } },
    })
    rows.push(...(data as unknown as DashboardOrderRow[]))
    if (data.length < PAGE) break
  }
  const time = (o: DashboardOrderRow) => new Date(o.created_at).getTime()
  const current = rows.filter((o) => time(o) >= period.from)
  const previous = rows.filter((o) => time(o) < period.from)

  const previousDates = periodFor(days, period.from - 1).dates
  const visitors = await fetchDailyVisitors(previousDates[0], period.dates[period.dates.length - 1])
  const visitorsOn = new Map((visitors ?? []).map((v) => [v.date, v]))
  const sumVisitors = (dates: string[]) => (visitors ? dates.reduce((t, d) => t + (visitorsOn.get(d)?.visitors ?? 0), 0) : null)

  const summary = summarise(current)
  const visitorTotal = sumVisitors(period.dates)
  res.json({
    days,
    from: new Date(period.from).toISOString(),
    to: new Date(period.to).toISOString(),
    today: londonDate(period.to),
    current: { ...summary, visitors: visitorTotal },
    previous: { ...summarise(previous), visitors: sumVisitors(previousDates) },
    conversion_rate: visitorTotal ? summary.orders / visitorTotal : null,
    visitors_available: visitors !== null,
    visitors_configured: visitorsConfigured(),
    daily: dailySales(current, period.dates).map((d) => ({
      ...d,
      visitors: visitors ? visitorsOn.get(d.date)?.visitors ?? 0 : null,
    })),
    top_products: topProducts(current),
  })
}
