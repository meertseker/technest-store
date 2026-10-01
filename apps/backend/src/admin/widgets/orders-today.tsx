import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, clx } from "@medusajs/ui"
import { useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { TAP } from "../components/shop-ui"
import { TodayStrip, useToday } from "../components/today"
import { isLandingPath } from "../lib/today"

// The admin always opens on the Orders list (after signing in, or from a
// bookmark of the admin's address). The shop's start page is Today, so the
// first time Orders is shown as that default landing we go to Today instead.
// Extensions load with the dashboard, so this is the address the admin was
// opened at, read once per page load. Opening Orders from the menu later, or
// opening one order or any other page directly, is never redirected.
const OPENED_AT = typeof window === "undefined" ? "" : window.location.pathname
let startPageShown = false

const OrdersTodayWidget = () => {
  const navigate = useNavigate()
  const { loading, tasks, summary } = useToday()

  useEffect(() => {
    if (startPageShown) return
    startPageShown = true
    if (isLandingPath(OPENED_AT)) navigate("/today", { replace: true })
  }, [navigate])

  // Below the list: only shown while something is waiting, so Orders stays clean
  const open = tasks.some((t) => t.tone === "action" || t.tone === "waiting")
  if (loading || !open) return null

  return (
    <Container className="flex flex-col gap-3 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <Heading level="h2">Today</Heading>
          <Text size="large" className="text-ui-fg-subtle">
            {summary}
          </Text>
        </div>
        <Link
          to="/today"
          className={clx(
            TAP,
            "text-ui-fg-interactive txt-compact-medium-plus inline-flex items-center underline-offset-2 hover:underline"
          )}
        >
          Open Today
        </Link>
      </div>
      <TodayStrip tasks={tasks} />
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.list.after",
})

export default OrdersTodayWidget
