import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath, CogSixTooth, ShoppingBag, Sun, Tag } from "@medusajs/icons"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { useQueryClient } from "@tanstack/react-query"
import type { ComponentType, ReactNode } from "react"
import { Link } from "react-router-dom"
import { COLLECT_QUERY_KEY, CollectBoard } from "../../components/orders/collect-board"
import { DELIVERY_QUERY_KEY, DeliveryList } from "../../components/orders/delivery-list"
import { REPAIR_QUERY_KEY, RepairList } from "../../components/orders/repair-list"
import { TRADE_QUERY_KEY, TradeList } from "../../components/orders/trade-list"
import { PageLoading, TAP } from "../../components/shop-ui"
import { TodayCard, useToday } from "../../components/today"
import type { TodayKey } from "../../lib/today"

// The shop's start page: what needs doing now, with the buttons in the list
// (the same rows as the Orders tabs), then the three pages.

const LIMIT = 5

/** The queues that can be worked on from here. Drafts stay a card (a link). */
const QUEUES: Partial<Record<TodayKey, ReactNode>> = {
  to_pick: <CollectBoard embedded status="to_pick" limit={LIMIT} />,
  to_pack: <DeliveryList embedded status="to_pack" limit={LIMIT} />,
  repairs_new: <RepairList embedded status="new" limit={LIMIT} />,
  trade_pending: <TradeList embedded status="pending" limit={LIMIT} />,
  ready: <CollectBoard embedded status="ready" limit={LIMIT} />,
}

const PAGES: { to: string; label: string; hint: string; Icon: ComponentType<{ className?: string }> }[] = [
  { to: "/shop-orders", label: "Orders", hint: "Collect, delivery, repairs and trade.", Icon: ShoppingBag },
  { to: "/shop-products", label: "Products", hint: "Add one, change a price or stock, import many.", Icon: Tag },
  { to: "/shop-settings", label: "Shop settings", hint: "Delivery and Klarna amounts, phone models.", Icon: CogSixTooth },
]

const TodayPage = () => {
  const queryClient = useQueryClient()
  const { loading, tasks, summary, updatedAt, refetch, fetching } = useToday()
  const open = tasks.filter((t) => t.tone !== "clear")

  const refreshAll = () => {
    refetch()
    for (const key of [COLLECT_QUERY_KEY, DELIVERY_QUERY_KEY, REPAIR_QUERY_KEY, TRADE_QUERY_KEY]) {
      queryClient.invalidateQueries({ queryKey: key })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-1">
          <Heading level="h1">Today</Heading>
          <Text size="large" weight="plus" role="status">
            {loading ? "Checking what needs doing…" : summary}
          </Text>
          {updatedAt > 0 && (
            <Text size="large" className="text-ui-fg-subtle">
              Updated{" "}
              {new Date(updatedAt).toLocaleTimeString("en-GB", {
                timeZone: "Europe/London",
                hour: "2-digit",
                minute: "2-digit",
              })}
              . Refreshes every minute.
            </Text>
          )}
        </div>
        <Button type="button" variant="secondary" className={TAP} onClick={refreshAll} isLoading={fetching}>
          <ArrowPath />
          Refresh
        </Button>
      </Container>

      {loading ? (
        <PageLoading />
      ) : open.length === 0 ? (
        <Container className="px-4 py-6 md:px-6">
          <Text size="large">Nothing waiting. Enjoy the quiet.</Text>
        </Container>
      ) : (
        open.map((task) => {
          const queue = task.tone === "unknown" ? undefined : QUEUES[task.key]
          const headingId = `today-${task.key}`
          return (
            <section key={task.key} aria-labelledby={headingId} className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <Heading level="h2" id={headingId}>
                  {task.title}
                </Heading>
                <Text size="large" className="text-ui-fg-subtle">
                  {task.detail}
                </Text>
              </div>
              {queue ?? <TodayCard task={task} />}
            </section>
          )
        })
      )}

      <section aria-labelledby="today-pages" className="flex flex-col gap-3">
        <Heading level="h2" id="today-pages" className="px-1">
          Pages
        </Heading>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PAGES.map(({ to, label, hint, Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="bg-ui-bg-component shadow-elevation-card-rest hover:bg-ui-bg-component-hover focus-visible:shadow-borders-interactive-with-focus flex min-h-16 items-center gap-3 rounded-lg p-4 outline-none transition-colors"
              >
                <Icon className="text-ui-fg-subtle shrink-0" />
                <span className="flex min-w-0 flex-col">
                  <Text as="span" size="large" weight="plus">
                    {label}
                  </Text>
                  <Text as="span" size="large" className="text-ui-fg-subtle">
                    {hint}
                  </Text>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Today",
  icon: Sun,
  rank: 0,
})

export default TodayPage
