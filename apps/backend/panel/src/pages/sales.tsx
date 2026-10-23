import { TriangleDownMini, TriangleUpMini } from "@medusajs/icons"
import { Container, Heading, Text, clx } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { FilterChips, PageLoading } from "../../../src/admin/components/shop-ui"
import { sdk } from "../../../src/admin/lib/client"
import { errorMessage, formatPence, plural } from "../../../src/admin/lib/format"

// Sales: the shop's numbers for today or the last 7/30/90 days, each against
// the same number of days before (GET /admin/shop-dashboard). Visitors come
// from Cloudflare. Phone first: stat tiles, then one chart, then best sellers.

type Totals = { sales_pence: number; orders: number; average_order_pence: number; refunds_pence: number; visitors: number | null }
type Dashboard = {
  days: number
  today: string
  current: Totals
  previous: Totals
  conversion_rate: number | null
  visitors_available: boolean
  visitors_configured: boolean
  daily: { date: string; sales_pence: number; orders: number; visitors: number | null }[]
  top_products: { title: string; quantity: number; sales_pence: number }[]
}

type Days = "1" | "7" | "30" | "90"
const PERIODS: { value: Days; label: string }[] = [
  { value: "1", label: "Today" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
]
const BEFORE: Record<Days, string> = { "1": "yesterday", "7": "the 7 days before", "30": "the 30 days before", "90": "the 90 days before" }

const SERIES = "#2a78d6" // validated against white (dataviz validator, light mode)

const percent = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`
const dayLabel = (iso: string, long = false) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(long ? { weekday: "short" } : {}), timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`)
  )

/** "↑ 12% on yesterday", or nothing to compare with. Arrow + words: never colour alone. */
function Change({ now, before, label, invert = false }: { now: number; before: number; label: string; invert?: boolean }) {
  if (before === 0) {
    return <span className="text-ui-fg-subtle txt-small">{now === 0 ? `Same as ${label}` : `Nothing ${label}`}</span>
  }
  const change = (now - before) / before
  if (Math.abs(change) < 0.005) return <span className="text-ui-fg-subtle txt-small">Same as {label}</span>
  const up = change > 0
  const good = invert ? !up : up
  return (
    <span className={clx("txt-small-plus inline-flex items-center", good ? "text-[#047857]" : "text-[#b91c1c]")}>
      {up ? <TriangleUpMini /> : <TriangleDownMini />}
      {up ? "Up" : "Down"} {percent(Math.abs(change))} on {label}
    </span>
  )
}

function Tile({ label, value, change, hero = false }: { label: string; value: string; change?: React.ReactNode; hero?: boolean }) {
  return (
    <div className={clx("bg-ui-bg-component shadow-elevation-card-rest flex flex-col gap-1 rounded-lg p-4", hero && "col-span-2 lg:col-span-3")}>
      <span className="txt-small-plus text-ui-fg-subtle">{label}</span>
      <span className={clx("font-semibold tabular-nums tracking-[-0.02em]", hero ? "text-[2.75rem] leading-none" : "text-2xl")}>{value}</span>
      {change}
    </div>
  )
}

function SalesChart({ daily, days }: { daily: Dashboard["daily"]; days: number }) {
  const [active, setActive] = useState<number | null>(null)
  const W = 640
  const H = 200
  const PAD_L = 44
  const PAD_B = 22
  const max = Math.max(...daily.map((d) => d.sales_pence), 100)
  const step = niceStep(max)
  const top = Math.ceil(max / step) * step
  const plotW = W - PAD_L
  const plotH = H - PAD_B - 8
  const slot = plotW / daily.length
  const barW = Math.min(24, Math.max(2, slot - 2))
  const y = (v: number) => 8 + plotH - (v / top) * plotH
  const ticks = [0, step, 2 * step, 3 * step, 4 * step].filter((t) => t <= top)
  const labelEvery = Math.ceil(daily.length / 6)
  const shown = active ?? (daily.length === 1 ? 0 : null)
  const a = shown !== null ? daily[shown] : null

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="sr-only">Sales per day. A table with the same numbers follows.</figcaption>
      <div className="txt-small text-ui-fg-subtle min-h-10" aria-live="polite">
        {a ? (
          <span>
            <strong className="text-ui-fg-base">{dayLabel(a.date, true)}</strong> · {formatPence(a.sales_pence)} · {plural(a.orders, "order")}
            {a.visitors !== null ? ` · ${plural(a.visitors, "visitor")}` : ""}
          </span>
        ) : (
          <span>Tap a day to see its numbers.</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none select-none" role="img" aria-label={`Sales per day for the last ${plural(days, "day")}`} onPointerLeave={() => setActive(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W} y1={y(t)} y2={y(t)} stroke="#ececf0" strokeWidth={1} />
            <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#6e6e73">
              {t >= 100000 ? `£${Math.round(t / 100000)}k` : `£${Math.round(t / 100)}`}
            </text>
          </g>
        ))}
        {daily.map((d, i) => {
          const x = PAD_L + i * slot + (slot - barW) / 2
          const h = Math.max(0, y(0) - y(d.sales_pence))
          const r = Math.min(4, barW / 2, h)
          return (
            <g key={d.date}>
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(0) - h + r} Q${x},${y(0) - h} ${x + r},${y(0) - h} H${x + barW - r} Q${x + barW},${y(0) - h} ${x + barW},${y(0) - h + r} V${y(0)} Z`}
                  fill={SERIES}
                  opacity={shown === null || shown === i ? 1 : 0.45}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={PAD_L + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="#6e6e73">
                  {dayLabel(d.date)}
                </text>
              )}
              {/* Hit area: the whole column, bigger than the bar. */}
              <rect x={PAD_L + i * slot} y={0} width={slot} height={H - PAD_B} fill="transparent" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
            </g>
          )
        })}
        <line x1={PAD_L} x2={W} y1={y(0)} y2={y(0)} stroke="#c7c7cc" strokeWidth={1} />
      </svg>
      <details className="txt-small">
        <summary className="text-ui-fg-interactive inline-flex min-h-11 cursor-pointer items-center">Show as a table</summary>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-ui-fg-subtle">
              <tr>
                <th scope="col" className="py-1.5 pr-3 font-medium">Day</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Sales</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Orders</th>
                <th scope="col" className="py-1.5 text-right font-medium">Visitors</th>
              </tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((d) => (
                <tr key={d.date} className="border-ui-border-base border-t">
                  <td className="py-1.5 pr-3">{dayLabel(d.date, true)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatPence(d.sales_pence)}</td>
                  <td className="py-1.5 pr-3 text-right">{d.orders}</td>
                  <td className="py-1.5 text-right">{d.visitors ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

/** 1, 2 or 5 times a power of ten, so the axis reads £0, £20, £40 ... */
function niceStep(max: number): number {
  const raw = max / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  return ([1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p) || 100
}

export function SalesPage() {
  const [params, setParams] = useSearchParams()
  const days = (PERIODS.find((p) => p.value === params.get("days"))?.value ?? "7") as Days
  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["panel", "dashboard", days],
    queryFn: () => sdk.client.fetch<Dashboard>("/admin/shop-dashboard", { query: { days } }),
    placeholderData: keepPreviousData,
    refetchInterval: 5 * 60_000,
  })

  const setDays = (next: Days) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set("days", next)
        return p
      },
      { replace: true }
    )

  const before = BEFORE[days]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 px-1">
        <Heading level="h1">Sales</Heading>
        <Text size="large" className="text-ui-fg-subtle">
          How the shop is doing online. Cancelled orders are left out; refunds are taken off.
        </Text>
      </div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <FilterChips options={PERIODS} value={days} onChange={setDays} label="Period" />
      </div>

      {isLoading ? (
        <PageLoading />
      ) : isError || !data ? (
        <Container className="px-4 py-4">
          <Text size="large" role="alert">
            {errorMessage(error)}
          </Text>
        </Container>
      ) : (
        <div className={clx("flex flex-col gap-4 transition-opacity", isFetching && "opacity-70")}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Tile
              hero
              label="Sales"
              value={formatPence(data.current.sales_pence)}
              change={<Change now={data.current.sales_pence} before={data.previous.sales_pence} label={before} />}
            />
            <Tile label="Orders" value={String(data.current.orders)} change={<Change now={data.current.orders} before={data.previous.orders} label={before} />} />
            <Tile
              label="Average order"
              value={formatPence(data.current.average_order_pence)}
              change={<Change now={data.current.average_order_pence} before={data.previous.average_order_pence} label={before} />}
            />
            <Tile
              label="Visitors"
              value={data.current.visitors === null ? "-" : data.current.visitors.toLocaleString("en-GB")}
              change={
                data.current.visitors === null ? (
                  <span className="txt-small text-ui-fg-subtle">{data.visitors_configured ? "Couldn't reach Cloudflare. Try again later." : "Not set up yet."}</span>
                ) : (
                  <Change now={data.current.visitors} before={data.previous.visitors ?? 0} label={before} />
                )
              }
            />
            <Tile
              label="Visitors who ordered"
              value={data.conversion_rate === null ? "-" : percent(data.conversion_rate)}
              change={<span className="txt-small text-ui-fg-subtle">Orders ÷ visitors</span>}
            />
            <Tile
              label="Refunds"
              value={formatPence(data.current.refunds_pence)}
              change={<Change now={data.current.refunds_pence} before={data.previous.refunds_pence} label={before} invert />}
            />
          </div>

          <Container className="flex flex-col gap-2 px-4 py-4 md:px-6">
            <Heading level="h2">Sales per day</Heading>
            <SalesChart daily={data.daily} days={data.days} />
          </Container>

          <Container className="flex flex-col gap-2 px-4 py-4 md:px-6">
            <Heading level="h2">Best sellers</Heading>
            {data.top_products.length ? (
              <ol className="flex flex-col">
                {data.top_products.map((p, i) => (
                  <li key={p.title} className="border-ui-border-base flex items-center gap-3 border-t py-2.5 first:border-0">
                    <span className="txt-small-plus text-ui-fg-subtle w-5 shrink-0">{i + 1}</span>
                    <span className="txt-medium min-w-0 flex-1 truncate">{p.title}</span>
                    <span className="txt-small text-ui-fg-subtle shrink-0">{p.quantity} sold</span>
                    <span className="txt-medium-plus w-20 shrink-0 text-right tabular-nums">{formatPence(p.sales_pence)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <Text size="large" className="text-ui-fg-subtle">
                No sales in this period yet.
              </Text>
            )}
          </Container>
          <Text size="small" className="text-ui-fg-subtle px-1">
            Visitors are counted by Cloudflare, which sits in front of the shop: one per device per day, a few bots included. No cookies are used.
          </Text>
        </div>
      )}
    </div>
  )
}
