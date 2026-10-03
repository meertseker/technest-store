import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath, BuildingStorefront } from "@medusajs/icons"
import { Alert, Badge, Button, Container, Heading, Text, clx, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"
import { ConfirmDialog, FilterChips, PageLoading, TAP } from "../../components/shop-ui"
import { sdk } from "../../lib/client"
import { errorMessage, formatDateTime, formatPence, timeAgo } from "../../lib/format"
import type { ClickCollectListResponse, ClickCollectOrder, CollectStatus } from "../../lib/types"

// Click & Collect board (docs/contracts/click-collect.md).
// Three columns on a wide screen, three tabs on a phone. Refreshes every minute.

const REFRESH_MS = 60_000
const COLLECTED_SHOWN = 20

const COLUMNS: { status: CollectStatus; title: string; empty: string; limit: number }[] = [
  { status: "to_pick", title: "To pick", empty: "Nothing to pick. New orders appear here.", limit: 100 },
  { status: "ready", title: "Ready", empty: "No orders waiting on the shelf.", limit: 100 },
  {
    status: "collected",
    title: "Collected",
    empty: "No collected orders yet.",
    limit: COLLECTED_SHOWN,
  },
]

const boardKey = (status: CollectStatus) => ["click-collect", status] as const

function useColumn(status: CollectStatus, limit: number) {
  return useQuery({
    queryKey: boardKey(status),
    queryFn: () =>
      sdk.client.fetch<ClickCollectListResponse>("/admin/click-collect/orders", {
        query: { status, limit },
      }),
    refetchInterval: REFRESH_MS,
  })
}

function OrderCard({ order }: { order: ClickCollectOrder }) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [confirmingReady, setConfirmingReady] = useState(false)
  const [error, setError] = useState<{ message: string; status?: number } | null>(null)

  const onError = (e: unknown) => {
    const status = (e as { status?: number }).status
    setError({ message: errorMessage(e), status })
    // The order may have moved (e.g. "Payment captured but ..."), so refresh the board.
    queryClient.invalidateQueries({ queryKey: ["click-collect"] })
  }

  const markReady = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ order: ClickCollectOrder }>(
        `/admin/click-collect/orders/${order.id}/ready`,
        { method: "POST" }
      ),
    onMutate: () => setError(null),
    onSuccess: ({ order: updated }) => {
      toast.success(`Order #${updated.display_id} is ready. Code ${updated.collection_code}.`)
      queryClient.invalidateQueries({ queryKey: ["click-collect"] })
    },
    onError,
  })

  const markCollected = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ order: ClickCollectOrder }>(
        `/admin/click-collect/orders/${order.id}/collected`,
        { method: "POST" }
      ),
    onMutate: () => setError(null),
    onSuccess: ({ order: updated }) => {
      toast.success(`Order #${updated.display_id} collected. Payment taken.`)
      queryClient.invalidateQueries({ queryKey: ["click-collect"] })
    },
    onError,
  })

  const busy = markReady.isPending || markCollected.isPending
  const titleId = `cc-order-${order.id}`

  return (
    <li
      className="bg-ui-bg-component shadow-elevation-card-rest flex flex-col gap-3 rounded-lg p-4"
      aria-labelledby={titleId}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link
          to={`/orders/${order.id}`}
          id={titleId}
          className="txt-large-plus text-ui-fg-interactive underline-offset-2 hover:underline"
        >
          Order #{order.display_id}
        </Link>
        <Text size="large" className="text-ui-fg-subtle">
          Placed {timeAgo(order.created_at)}
        </Text>
      </div>

      {order.collection_code ? (
        <div>
          <Text size="small" className="text-ui-fg-subtle uppercase tracking-wide">
            Collection code
          </Text>
          <p
            className="text-ui-fg-base font-mono text-4xl font-semibold tracking-[0.2em]"
            aria-label={`Collection code ${order.collection_code.split("").join(" ")}`}
          >
            {order.collection_code}
          </p>
        </div>
      ) : (
        <Text size="large" className="text-ui-fg-subtle">
          The collection code is made when you press Mark ready.
        </Text>
      )}

      <div className="flex flex-col gap-1">
        <Text size="large" weight="plus">
          {order.customer_name ?? "Customer name not given"}
        </Text>
        <ul className="flex flex-col" aria-label="Items">
          {order.items.map((item, i) => (
            <li key={i}>
              <Text size="large">
                {item.quantity} x {item.title}
                {item.variant_title ? ` (${item.variant_title})` : ""}
              </Text>
            </li>
          ))}
        </ul>
        <Text size="large" weight="plus">
          Total {formatPence(order.total_pence)}{" "}
          <Text as="span" size="large" className="text-ui-fg-subtle">
            inc. VAT
          </Text>
        </Text>
      </div>

      <dl className="text-ui-fg-subtle grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 txt-medium">
        {order.ready_at && (
          <>
            <dt>Ready</dt>
            <dd>
              {formatDateTime(order.ready_at)} ({timeAgo(order.ready_at)})
            </dd>
          </>
        )}
        {order.collected_at && (
          <>
            <dt>Collected</dt>
            <dd>{formatDateTime(order.collected_at)}</dd>
          </>
        )}
        {order.status === "ready" && (
          <>
            <dt>Reminder</dt>
            <dd>
              {order.reminder_sent_at
                ? `Sent ${formatDateTime(order.reminder_sent_at)}`
                : "Not sent yet (sent 3 days after ready)"}
            </dd>
          </>
        )}
      </dl>

      {order.reminder_sent_at && order.status === "ready" && (
        <Badge color="orange" className="self-start">
          Reminder sent. Cancelled automatically 7 days after ready.
        </Badge>
      )}

      {error && (
        <Alert variant="error" role="alert">
          <span className="txt-medium">{error.message}</span>
          {error.status === 409 && (
            <span className="txt-medium block">Refresh the board and try again.</span>
          )}
        </Alert>
      )}

      {order.status === "to_pick" && (
        <Button
          type="button"
          size="large"
          className={clx(TAP, "w-full")}
          onClick={() => setConfirmingReady(true)}
          isLoading={markReady.isPending}
          disabled={busy}
        >
          Mark ready
        </Button>
      )}
      {order.status === "ready" && (
        <Button
          type="button"
          size="large"
          className={clx(TAP, "w-full")}
          onClick={() => setConfirming(true)}
          isLoading={markCollected.isPending}
          disabled={busy}
        >
          Collected
        </Button>
      )}

      <ConfirmDialog
        open={confirmingReady}
        title={`Is order #${order.display_id} picked and ready?`}
        description={
          <>
            Pressing Mark ready emails {order.customer_name ?? "the customer"} now to say the order
            can be collected, with their collection code. It can't be undone.
          </>
        }
        confirmText="Yes, mark ready"
        cancelText="Not yet"
        onCancel={() => setConfirmingReady(false)}
        onConfirm={() => {
          setConfirmingReady(false)
          markReady.mutate()
        }}
      />

      <ConfirmDialog
        open={confirming}
        title={`Hand over order #${order.display_id}?`}
        description={
          <>
            Check the code <strong className="font-mono">{order.collection_code}</strong> with the
            customer first. Pressing Collected takes the payment of{" "}
            {formatPence(order.total_pence)} from their card.
          </>
        }
        confirmText="Yes, collected"
        cancelText="Not yet"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          markCollected.mutate()
        }}
      />
    </li>
  )
}

function Column({
  status,
  title,
  empty,
  query,
  active,
}: {
  status: CollectStatus
  title: string
  empty: string
  query: ReturnType<typeof useColumn>
  active: boolean
}) {
  const orders = query.data?.orders ?? []
  const count = query.data?.count
  const headingId = `cc-col-${status}`
  return (
    <section
      aria-labelledby={headingId}
      className={clx("flex-col gap-3", active ? "flex" : "hidden lg:flex")}
    >
      <Heading level="h2" id={headingId} className="flex items-center gap-2">
        {title}
        {count !== undefined && (
          <Badge size="small" color={status === "ready" ? "green" : "grey"}>
            {count}
          </Badge>
        )}
      </Heading>
      {query.isLoading ? (
        <PageLoading />
      ) : query.isError ? (
        <Alert variant="error" role="alert">
          {errorMessage(query.error)}
        </Alert>
      ) : orders.length === 0 ? (
        <Text size="large" className="text-ui-fg-subtle">
          {empty}
        </Text>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </ul>
      )}
      {status === "collected" && count !== undefined && count > orders.length && (
        <Text size="large" className="text-ui-fg-subtle">
          Showing the latest {orders.length} of {count}. Older ones are under Orders.
        </Text>
      )}
    </section>
  )
}

const ClickCollectPage = () => {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<CollectStatus>("to_pick")
  const queries = {
    to_pick: useColumn("to_pick", COLUMNS[0].limit),
    ready: useColumn("ready", COLUMNS[1].limit),
    collected: useColumn("collected", COLUMNS[2].limit),
  }
  const updatedAt = Math.max(...Object.values(queries).map((q) => q.dataUpdatedAt))
  const fetching = Object.values(queries).some((q) => q.isFetching)

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Heading level="h1">Click & Collect</Heading>
            <Text size="large" className="text-ui-fg-subtle">
              Updates every minute.
              {updatedAt > 0 &&
                ` Last updated ${new Date(updatedAt).toLocaleTimeString("en-GB", {
                  timeZone: "Europe/London",
                  hour: "2-digit",
                  minute: "2-digit",
                })}.`}
            </Text>
          </div>
          <Button
            type="button"
            variant="secondary"
            className={TAP}
            onClick={() => queryClient.invalidateQueries({ queryKey: ["click-collect"] })}
            isLoading={fetching}
          >
            <ArrowPath />
            Refresh
          </Button>
        </div>
        <div className="lg:hidden">
          <FilterChips
            label="Board column"
            value={tab}
            onChange={setTab}
            options={COLUMNS.map((c) => ({
              value: c.status,
              label: c.title,
              count: queries[c.status].data?.count,
            }))}
          />
        </div>
      </Container>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {COLUMNS.map((c) => (
          <Column
            key={c.status}
            status={c.status}
            title={c.title}
            empty={c.empty}
            query={queries[c.status]}
            active={tab === c.status}
          />
        ))}
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Click & Collect",
  icon: BuildingStorefront,
  rank: 1,
})

export default ClickCollectPage
