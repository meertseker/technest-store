import { TriangleRightMini } from "@medusajs/icons"
import { Text, clx } from "@medusajs/ui"
import { useQueries } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { sdk } from "../lib/client"
import { type TodayCounts, type TodayTask, todaySummary, todayTasks } from "../lib/today"
import { TAP } from "./shop-ui"

// The numbers behind the Today page and the summary above the Orders list.
// Five small requests to pages the shop already has; refreshed every minute.

const REFRESH_MS = 60_000

type Counted = { count: number }

const count = (path: string, query: Record<string, unknown>) => () =>
  sdk.client.fetch<Counted>(path, { query: { ...query, limit: 1 } }).then((r) => r.count)

const SOURCES: { key: keyof TodayCounts; queryFn: () => Promise<number> }[] = [
  { key: "to_pick", queryFn: count("/admin/click-collect/orders", { status: "to_pick" }) },
  { key: "ready", queryFn: count("/admin/click-collect/orders", { status: "ready" }) },
  { key: "repairs_new", queryFn: count("/admin/repair-bookings", { status: "new" }) },
  { key: "trade_pending", queryFn: count("/admin/trade-applications", { status: "pending" }) },
  { key: "drafts", queryFn: count("/admin/products", { status: ["draft"], fields: "id" }) },
]

export function useToday() {
  const results = useQueries({
    queries: SOURCES.map((s) => ({
      queryKey: ["today", s.key],
      queryFn: s.queryFn,
      refetchInterval: REFRESH_MS,
    })),
  })
  const loading = results.some((r) => r.isLoading)
  const counts = Object.fromEntries(
    SOURCES.map((s, i) => [s.key, results[i].isError ? null : (results[i].data ?? null)])
  ) as TodayCounts
  const tasks = todayTasks(counts)
  return {
    loading,
    tasks,
    summary: todaySummary(tasks),
    updatedAt: Math.max(0, ...results.map((r) => r.dataUpdatedAt)),
    refetch: () => results.forEach((r) => r.refetch()),
    fetching: results.some((r) => r.isFetching),
  }
}

const NUMBER_TONE: Record<TodayTask["tone"], string> = {
  action: "bg-ui-tag-orange-bg text-ui-tag-orange-text",
  waiting: "bg-ui-tag-blue-bg text-ui-tag-blue-text",
  clear: "bg-ui-tag-green-bg text-ui-tag-green-text",
  unknown: "bg-ui-bg-subtle text-ui-fg-subtle",
}

/** One job: a big number, what it is, what to do, and the whole card is the link */
export function TodayCard({ task }: { task: TodayTask }) {
  return (
    <Link
      to={task.to}
      className="bg-ui-bg-component shadow-elevation-card-rest hover:bg-ui-bg-component-hover focus-visible:shadow-borders-interactive-with-focus flex min-h-24 items-center gap-4 rounded-lg p-4 outline-none transition-colors"
    >
      <span
        aria-hidden
        className={clx(
          "flex size-14 shrink-0 items-center justify-center rounded-full text-2xl font-semibold tabular-nums",
          NUMBER_TONE[task.tone]
        )}
      >
        {task.count === null ? "?" : task.tone === "clear" ? "✓" : task.count}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Text as="span" size="large" weight="plus">
          {task.title}
        </Text>
        <Text as="span" size="large" className="text-ui-fg-subtle">
          {task.detail}
        </Text>
      </span>
      <TriangleRightMini aria-hidden className="text-ui-fg-muted shrink-0" />
    </Link>
  )
}

/** A wrapped row of links for the top of the Orders list: only what needs doing */
export function TodayStrip({ tasks }: { tasks: TodayTask[] }) {
  const open = tasks.filter((t) => t.tone === "action" || t.tone === "waiting")
  if (!open.length) return null
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Today's jobs">
      {open.map((t) => (
        <li key={t.key}>
          <Link
            to={t.to}
            className={clx(
              TAP,
              "shadow-borders-base bg-ui-bg-base hover:bg-ui-bg-base-hover focus-visible:shadow-borders-interactive-with-focus txt-compact-medium-plus inline-flex items-center gap-2 rounded-md px-3 outline-none transition-colors"
            )}
          >
            {t.title}
            <TriangleRightMini aria-hidden className="text-ui-fg-muted" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
