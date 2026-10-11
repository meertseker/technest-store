import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShoppingBag } from "@medusajs/icons"
import { Container, Heading, Text, clx } from "@medusajs/ui"
import { Link } from "react-router-dom"
import { CollectBoard } from "../../components/orders/collect-board"
import { DeliveryList } from "../../components/orders/delivery-list"
import { RepairList } from "../../components/orders/repair-list"
import { TradeList } from "../../components/orders/trade-list"
import { PageTabs } from "../../components/page-tabs"
import { TAP } from "../../components/shop-ui"
import { useUrlTab } from "../../lib/tabs"

// The Orders page: everything a customer is waiting on, in four tabs. The open
// tab is in the URL (?tab=), so Today and the owner guides link straight to it.

const TABS = [
  { value: "collect", label: "Collect" },
  { value: "delivery", label: "Delivery" },
  { value: "repairs", label: "Repairs" },
  { value: "trade", label: "Trade" },
] as const
type Tab = (typeof TABS)[number]["value"]
const TAB_VALUES = TABS.map((t) => t.value)

const ShopOrdersPage = () => {
  const [tab, setTab] = useUrlTab<Tab>(TAB_VALUES, "collect")
  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-1">
          <Heading level="h1">Orders</Heading>
          <Text size="large" className="text-ui-fg-subtle">
            Collect, delivery, repairs and trade in one place.
          </Text>
        </div>
        {/* Medusa's own list is off the menu; older or unusual orders (refunds, returns) live there. */}
        <Link
          to="/orders"
          className={clx(TAP, "text-ui-fg-interactive txt-large-plus inline-flex items-center underline-offset-2 hover:underline")}
        >
          All orders
        </Link>
      </Container>
      <PageTabs tabs={TABS} value={tab} onChange={setTab}>
        {{
          collect: <CollectBoard />,
          delivery: <DeliveryList />,
          repairs: <RepairList />,
          trade: <TradeList />,
        }}
      </PageTabs>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Orders",
  icon: ShoppingBag,
  rank: 1,
})

export default ShopOrdersPage
