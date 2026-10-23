import { Badge, Container, Heading, Input, Label, Text } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"
import { PageLoading, Pager, TAP } from "../../../src/admin/components/shop-ui"
import { sdk } from "../../../src/admin/lib/client"
import { errorMessage, formatDateTime, formatPence } from "../../../src/admin/lib/format"
import { toPence } from "../../../src/admin/lib/order-detail"
import { useDebounced } from "../../../src/admin/lib/use-debounced"
import { PaymentBadge } from "./order"

// Every order, newest first, with a search: for finding an older order to
// refund or check. The day-to-day queues are on the Orders page.

const PAGE_SIZE = 20

type Row = {
  id: string
  display_id: number
  created_at: string
  email: string | null
  total: number | string
  status: string
  payment_status: string
  fulfillment_status: string
  shipping_address?: { first_name?: string | null; last_name?: string | null } | null
}

export function AllOrdersPage() {
  const [q, setQ] = useState("")
  const [offset, setOffset] = useState(0)
  const search = useDebounced(q.trim(), 300)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["panel", "orders", search, offset],
    queryFn: () =>
      sdk.client.fetch<{ orders: Row[]; count: number }>("/admin/orders", {
        query: {
          q: search || undefined,
          limit: PAGE_SIZE,
          offset,
          order: "-created_at",
          fields:
            "id,display_id,created_at,email,total,status,payment_status,fulfillment_status,shipping_address.first_name,shipping_address.last_name",
        },
      }),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-1">
          <Heading level="h1">All orders</Heading>
          <Text size="large" className="text-ui-fg-subtle">
            Find any order, to check it or give a refund.
          </Text>
        </div>
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
          <Text size="large">{search ? "No order matches that search." : "No orders yet."}</Text>
        </Container>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {data.orders.map((o) => {
              const name = [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(" ")
              return (
                <li key={o.id}>
                  <Link
                    to={`/orders/${o.id}`}
                    className="bg-ui-bg-component shadow-elevation-card-rest hover:bg-ui-bg-component-hover focus-visible:shadow-borders-interactive-with-focus flex min-h-16 flex-wrap items-center justify-between gap-2 rounded-lg p-4 outline-none"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="txt-large-plus">Order #{o.display_id}</span>
                      <span className="txt-medium text-ui-fg-subtle truncate">
                        {formatDateTime(o.created_at)} · {name || o.email || "No name"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {o.status === "canceled" ? (
                        <Badge color="grey">Cancelled</Badge>
                      ) : (
                        <PaymentBadge status={o.payment_status} />
                      )}
                      <span className="txt-large-plus">{formatPence(toPence(o.total))}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <Pager offset={offset} limit={PAGE_SIZE} count={data.count} onChange={setOffset} />
        </>
      )}
    </div>
  )
}
