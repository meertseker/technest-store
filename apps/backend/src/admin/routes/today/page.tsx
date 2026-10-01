import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath, ArrowUpTray, Camera, CogSixTooth, ShoppingBag, Sun, Tag } from "@medusajs/icons"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import type { ComponentType } from "react"
import { Link } from "react-router-dom"
import { PageLoading, TAP } from "../../components/shop-ui"
import { TodayCard, useToday } from "../../components/today"

// The shop's start page: what needs doing now, then the things done most often.
// Everything here links to a page that already exists; nothing is changed here.

const SHORTCUTS: { to: string; label: string; hint: string; Icon: ComponentType<{ className?: string }> }[] = [
  { to: "/quick-add", label: "Add a product", hint: "Take a photo and fill in the details.", Icon: Camera },
  { to: "/orders", label: "Orders", hint: "Delivery orders: pack them, then mark as shipped.", Icon: ShoppingBag },
  { to: "/products", label: "Products", hint: "Change a price, stock or photo.", Icon: Tag },
  { to: "/import", label: "Import products", hint: "Add or update many from a spreadsheet.", Icon: ArrowUpTray },
  { to: "/settings/technest", label: "Shop settings", hint: "Free delivery and Klarna amounts.", Icon: CogSixTooth },
]

const TodayPage = () => {
  const { loading, tasks, summary, updatedAt, refetch, fetching } = useToday()

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
        <Button type="button" variant="secondary" className={TAP} onClick={refetch} isLoading={fetching}>
          <ArrowPath />
          Refresh
        </Button>
      </Container>

      <section aria-labelledby="today-jobs" className="flex flex-col gap-3">
        <Heading level="h2" id="today-jobs" className="px-1">
          To do
        </Heading>
        {loading ? (
          <PageLoading />
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {tasks.map((t) => (
              <li key={t.key}>
                <TodayCard task={t} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="today-shortcuts" className="flex flex-col gap-3">
        <Heading level="h2" id="today-shortcuts" className="px-1">
          Shortcuts
        </Heading>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHORTCUTS.map(({ to, label, hint, Icon }) => (
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
