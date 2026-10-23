import { Badge, Container, Heading, Input, Label, Text } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { CollectBoard } from "../../../src/admin/components/orders/collect-board"
import { DeliveryList } from "../../../src/admin/components/orders/delivery-list"
import { RepairList } from "../../../src/admin/components/orders/repair-list"
import { TradeList } from "../../../src/admin/components/orders/trade-list"
import { PageTabs } from "../../../src/admin/components/page-tabs"
import { FilterChips, PageLoading, Pager, TAP } from "../../../src/admin/components/shop-ui"
import { sdk } from "../../../src/admin/lib/client"
import { errorMessage, formatDate, formatDateTime, formatPence, plural } from "../../../src/admin/lib/format"
import { toPence } from "../../../src/admin/lib/order-detail"
import { useUrlTab } from "../../../src/admin/lib/tabs"
import { useDebounced } from "../../../src/admin/lib/use-debounced"
import { FulfilmentBadge, PaymentBadge } from "./order"

// Orders, like Shopify's: every order in one list (search, open/completed/
// cancelled), next to the day's queues (Collect, Delivery, Repairs, Trade).
// A card per order on a phone, a table from `lg`.

const TABS = [
  { value: "all", label: "All orders" },
  { value: "collect", label: "Collect" },
  { value: "delivery", label: "Delivery" },
  { value: "repairs", label: "Repairs" },
  { value: "trade", label: "Trade" },
] as const
type Tab = (typeof TABS)[number]["value"]
const TAB_VALUES = TABS.map((t) => t.value)

export function OrdersPage() {
  const [tab, setTab] = useUrlTab<Tab>(TAB_VALUES, "all")
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 px-1">
        <Heading level="h1">Orders</Heading>
        <Text size="large" className="text-ui-fg-subtle">
          Every order, and what's waiting to be picked, packed or answered.
        </Text>
      </div>
      <PageTabs tabs={TABS} value={tab} onChange={setTab}>
        {{
          all: <OrderList />,
          collect: <CollectBoard />,
          delivery: <DeliveryList />,
          repairs: <RepairList />,
          trade: <TradeList />,
        }}
      </PageTabs>
    </div>
  )
}

const PAGE_SIZE = 20

type Status = "all" | "open" | "completed" | "canceled"
const STATUS_FILTER: Record<Status, string[] | undefined> = {
  all: undefined,
  open: ["pending", "requires_action"],
  completed: ["completed", "archived"],
  canceled: ["canceled"],
}
const STATUS_CHIPS: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Cancelled" },
]

export type OrderRow = {
  id: string
  display_id: number
  created_at: string
  email: string | null
  total: number | string
  original_total?: number | string | null
  status: string
  payment_status: string
  fulfillment_status: string
  shipping_address?: { first_name?: string | null; last_name?: string | null } | null
  items?: { quantity: number }[] | null
}

export const ORDER_ROW_FIELDS =
  "id,display_id,created_at,email,total,original_total,status,payment_status,fulfillment_status,shipping_address.first_name,shipping_address.last_name,items.quantity"

const nameOf = (o: OrderRow) =>
  [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(" ") || o.email || "No name"
const itemCount = (o: OrderRow) => (o.items ?? []).reduce((t, i) => t + Number(i.quantity || 0), 0)
const amountOf = (o: OrderRow) => formatPence(toPence(o.original_total ?? o.total))

function Badges({ o }: { o: OrderRow }) {
  return o.status === "canceled" ? (
    <Badge color="grey">Cancelled</Badge>
  ) : (
    <>
      <PaymentBadge status={o.payment_status} />
      {/* Nothing is left to send for a fully refunded order. */}
      {o.payment_status !== "refunded" && <FulfilmentBadge status={o.fulfillment_status} />}
    </>
  )
}

/** One order per card on a phone; a table row from `lg`. */
export function OrderRows({ orders }: { orders: OrderRow[] }) {
  return (
    <>
      <ul className="flex flex-col gap-2 lg:hidden">
        {orders.map((o) => (
          <li key={o.id}>
            <Link
              to={`/orders/${o.id}`}
              className="press bg-ui-bg-component shadow-elevation-card-rest flex flex-col gap-2 rounded-lg p-4 outline-none focus-visible:ring-2 focus-visible:ring-[#d6001c]"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="txt-large-plus">#{o.display_id}</span>
                <span className="txt-large-plus tabular-nums">{amountOf(o)}</span>
              </span>
              <span className="flex items-baseline justify-between gap-2">
                <span className="txt-medium min-w-0 truncate">{nameOf(o)}</span>
                <span className="txt-small text-ui-fg-subtle shrink-0">{formatDate(o.created_at)}</span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <Badges o={o} />
                <span className="txt-small text-ui-fg-subtle">{plural(itemCount(o), "item")}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="bg-ui-bg-component shadow-elevation-card-rest hidden overflow-hidden rounded-lg lg:block">
        <table className="w-full text-left">
          <thead className="txt-small-plus text-ui-fg-subtle border-ui-border-base border-b">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Order</th>
              <th scope="col" className="px-4 py-3 font-medium">Date</th>
              <th scope="col" className="px-4 py-3 font-medium">Customer</th>
              <th scope="col" className="px-4 py-3 font-medium">Payment / delivery</th>
              <th scope="col" className="px-4 py-3 font-medium">Items</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="txt-medium">
            {orders.map((o) => (
              <tr key={o.id} className="border-ui-border-base hover:bg-ui-bg-component-hover relative border-b last:border-0">
                <td className="px-4 py-3">
                  {/* The whole row opens the order; the link carries the name for screen readers. */}
                  <Link to={`/orders/${o.id}`} className="txt-medium-plus after:absolute after:inset-0 focus-visible:underline">
                    #{o.display_id}
                  </Link>
                </td>
                <td className="text-ui-fg-subtle px-4 py-3">{formatDateTime(o.created_at)}</td>
                <td className="max-w-56 truncate px-4 py-3">{nameOf(o)}</td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1.5">
                    <Badges o={o} />
                  </span>
                </td>
                <td className="text-ui-fg-subtle px-4 py-3">{itemCount(o)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{amountOf(o)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function OrderList() {
  const [params, setParams] = useSearchParams()
  const status = (STATUS_CHIPS.find((c) => c.value === params.get("status"))?.value ?? "all") as Status
  const [q, setQ] = useState("")
  const [offset, setOffset] = useState(0)
  const search = useDebounced(q.trim(), 300)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["panel", "orders", search, status, offset],
    queryFn: () =>
      sdk.client.fetch<{ orders: OrderRow[]; count: number }>("/admin/orders", {
        query: { q: search || undefined, status: STATUS_FILTER[status], limit: PAGE_SIZE, offset, order: "-created_at", fields: ORDER_ROW_FIELDS },
      }),
    placeholderData: keepPreviousData,
  })

  const setStatus = (next: Status) => {
    setOffset(0)
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === "all") p.delete("status")
        else p.set("status", next)
        return p
      },
      { replace: true }
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Container className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order-search" size="base" weight="plus">
            Search by order number, email or name
          </Label>
          <Input
            id="order-search"
            type="search"
            size="base"
            className={TAP}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setOffset(0)
            }}
          />
        </div>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <FilterChips options={STATUS_CHIPS} value={status} onChange={setStatus} label="Show" />
        </div>
      </Container>

      {isLoading ? (
        <PageLoading />
      ) : isError ? (
        <Container className="px-4 py-4">
          <Text size="large" role="alert">
            {errorMessage(error)}
          </Text>
        </Container>
      ) : !data?.orders.length ? (
        <Container className="px-4 py-6">
          <Text size="large">{search ? "No order matches that search." : "No orders here yet."}</Text>
        </Container>
      ) : (
        <>
          <Text size="small" className="text-ui-fg-subtle px-1" role="status">
            {plural(data.count, "order")}
          </Text>
          <OrderRows orders={data.orders} />
          <Pager offset={offset} limit={PAGE_SIZE} count={data.count} onChange={setOffset} />
        </>
      )}
    </div>
  )
}
