import { ArrowPath } from "@medusajs/icons"
import { Alert, Badge, Button, Container, Heading, Input, Label, Text, clx, toast } from "@medusajs/ui"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"
import { sdk } from "../../lib/client"
import {
  deliveryPlace,
  type DeliveryListResponse,
  type DeliveryOrder,
  type DeliveryStatus,
  paymentBadge,
  type ShippedResponse,
  shipBlocker,
  type TrackingBody,
  trackingInput,
} from "../../lib/delivery"
import { errorMessage, formatDateTime, formatPence, plural, timeAgo } from "../../lib/format"
import { ConfirmDialog, FilterChips, PageLoading, Pager, TAP } from "../shop-ui"

// Delivery orders (docs/contracts/delivery-orders.md): the Delivery tab of the
// Orders page, and (embedded) the ones to pack on Today. Refreshes every minute.

const REFRESH_MS = 60_000
const PAGE_SIZE = 20

export const DELIVERY_QUERY_KEY = ["delivery-orders"] as const

const FILTERS: { value: DeliveryStatus; label: string; empty: string }[] = [
  { value: "to_pack", label: "To pack", empty: "Nothing to pack. New delivery orders appear here." },
  { value: "shipped", label: "Shipped", empty: "Nothing shipped yet." },
]

function useDeliveryList(status: DeliveryStatus, offset: number, limit: number) {
  return useQuery({
    queryKey: [...DELIVERY_QUERY_KEY, status, offset, limit],
    queryFn: () =>
      sdk.client.fetch<DeliveryListResponse>("/admin/delivery-orders", {
        query: { status, limit, offset },
      }),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  })
}

export function DeliveryOrderCard({ order }: { order: DeliveryOrder }) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<{ message: string; status?: number } | null>(null)
  const [trackingNumber, setTrackingNumber] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")
  const [trackingError, setTrackingError] = useState<string | null>(null)

  const markShipped = useMutation({
    mutationFn: (body: TrackingBody) =>
      sdk.client.fetch<ShippedResponse>(`/admin/delivery-orders/${order.id}/shipped`, {
        method: "POST",
        body,
      }),
    onMutate: () => setError(null),
    onSuccess: (r) => {
      toast.success(
        r.already_shipped
          ? `Order #${order.display_id} was already on its way.`
          : `Order #${order.display_id} is on its way. The customer has been emailed.`
      )
      queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEY })
    },
    onError: (e: unknown) => {
      setError({ message: errorMessage(e), status: (e as { status?: number }).status })
      queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEY })
    },
  })

  const titleId = `delivery-order-${order.id}`
  const blockerId = `delivery-blocker-${order.id}`
  const trackingId = `delivery-tracking-${order.id}`
  const place = deliveryPlace(order)
  const badge = paymentBadge(order)
  const blocker = order.status === "to_pack" ? shipBlocker(order) : null

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

      <div className="flex flex-col gap-1">
        <Text size="large" weight="plus">
          {order.customer_name ?? "Customer name not given"}
          {place ? (
            <Text as="span" size="large" className="text-ui-fg-subtle">
              {" "}
              · {place}
            </Text>
          ) : null}
        </Text>
        <ul className="flex flex-col" aria-label="Items">
          {order.items.map((item) => (
            <li key={item.id}>
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
            inc. VAT and delivery
          </Text>
        </Text>
      </div>

      {(badge || order.partly_shipped || (order.status === "shipped" && order.shipped_at)) && (
        <div className="flex flex-wrap gap-2">
          {badge && (
            <Badge color={badge.color} size="large">
              {badge.label}
            </Badge>
          )}
          {order.partly_shipped && (
            <Badge color="blue" size="large">
              Part of this order has left
            </Badge>
          )}
          {order.status === "shipped" && order.shipped_at && (
            <Badge color="green" size="large">
              Shipped {formatDateTime(order.shipped_at)} ({timeAgo(order.shipped_at)})
            </Badge>
          )}
        </div>
      )}

      {error && (
        <Alert variant="error" role="alert">
          <span className="txt-medium">{error.message}</span>
          {error.status === 409 && <span className="txt-medium block">Refresh and try again.</span>}
        </Alert>
      )}

      {order.status === "to_pack" && (
        <div className="flex flex-col gap-2">
          {blocker && (
            <Text size="large" id={blockerId} className="text-ui-fg-error">
              {blocker}
            </Text>
          )}
          <Button
            type="button"
            size="large"
            className={clx(TAP, "w-full")}
            onClick={() => setConfirming(true)}
            isLoading={markShipped.isPending}
            disabled={markShipped.isPending || !!blocker}
            aria-describedby={blocker ? blockerId : undefined}
          >
            Packed & shipped
          </Button>
        </div>
      )}

      <Text size="large" className="text-ui-fg-subtle">
        Address, refund or anything else:{" "}
        <Link to={`/orders/${order.id}`} className="text-ui-fg-interactive underline-offset-2 hover:underline">
          open the order
        </Link>
        .
      </Text>

      <ConfirmDialog
        open={confirming}
        title={`Mark order #${order.display_id} as shipped?`}
        description={
          <>
            Only press this once the parcel is with the carrier. {order.customer_name ?? "The customer"}{" "}
            gets an "on its way" email straight away. It can't be undone.
          </>
        }
        confirmText="Yes, it's shipped"
        cancelText="Not yet"
        onCancel={() => {
          setConfirming(false)
          setTrackingError(null)
        }}
        onConfirm={() => {
          const tracking = trackingInput(trackingNumber, trackingUrl)
          if (!tracking.ok) {
            setTrackingError(tracking.error)
            return false
          }
          setTrackingError(null)
          setConfirming(false)
          markShipped.mutate(tracking.body)
        }}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${trackingId}-number`} size="base">
            Tracking number (optional)
          </Label>
          <Input
            id={`${trackingId}-number`}
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            maxLength={64}
            autoComplete="off"
            className="min-h-11 text-base"
            placeholder="e.g. RM123456789GB"
            aria-invalid={!!trackingError}
            aria-describedby={trackingError ? `${trackingId}-error` : `${trackingId}-hint`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${trackingId}-url`} size="base">
            Tracking link (optional)
          </Label>
          <Input
            id={`${trackingId}-url`}
            type="url"
            inputMode="url"
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            maxLength={500}
            autoComplete="off"
            className="min-h-11 text-base"
            placeholder="https://"
            aria-invalid={!!trackingError}
            aria-describedby={trackingError ? `${trackingId}-error` : `${trackingId}-hint`}
          />
        </div>
        {trackingError ? (
          <Text size="base" className="text-ui-fg-error" id={`${trackingId}-error`} role="alert">
            {trackingError}
          </Text>
        ) : (
          <Text size="base" className="text-ui-fg-subtle" id={`${trackingId}-hint`}>
            Both go in the customer's email. Leave them empty if the parcel has no tracking.
          </Text>
        )}
      </ConfirmDialog>
    </li>
  )
}

export type DeliveryListProps = {
  /** Today: one status only, no heading or chips, at most `limit` cards. */
  embedded?: boolean
  status?: DeliveryStatus
  limit?: number
}

export const DeliveryList = ({ embedded, status = "to_pack", limit = 5 }: DeliveryListProps) => {
  if (embedded) return <EmbeddedDeliveryList status={status} limit={limit} />
  return <FullDeliveryList />
}

/** Renders nothing while empty. */
function EmbeddedDeliveryList({ status, limit }: { status: DeliveryStatus; limit: number }) {
  const { data, isLoading, isError, error } = useDeliveryList(status, 0, limit)
  if (isLoading) return <PageLoading />
  if (isError) {
    return (
      <Alert variant="error" role="alert">
        {errorMessage(error)}
      </Alert>
    )
  }
  const orders = data?.orders ?? []
  if (!orders.length) return null
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {orders.map((o) => (
          <DeliveryOrderCard key={o.id} order={o} />
        ))}
      </ul>
      {data!.count > orders.length && (
        <Link
          to="/shop-orders?tab=delivery"
          className={clx(TAP, "text-ui-fg-interactive txt-large-plus inline-flex items-center underline-offset-2 hover:underline")}
        >
          See all {data!.count}
        </Link>
      )}
    </div>
  )
}

const FullDeliveryList = () => {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<DeliveryStatus>("to_pack")
  const [offset, setOffset] = useState(0)
  const query = useDeliveryList(status, offset, PAGE_SIZE)
  const orders = query.data?.orders ?? []
  const filter = FILTERS.find((f) => f.value === status)!

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Heading level="h2">Delivery orders</Heading>
            <Text size="large" className="text-ui-fg-subtle">
              Pack the parcel, hand it to the carrier, then press Packed & shipped. Updates every minute.
            </Text>
          </div>
          <Button
            type="button"
            variant="secondary"
            className={TAP}
            onClick={() => queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEY })}
            isLoading={query.isFetching}
          >
            <ArrowPath />
            Refresh
          </Button>
        </div>
        <FilterChips<DeliveryStatus>
          label="Show orders"
          value={status}
          onChange={(s) => {
            setOffset(0)
            setStatus(s)
          }}
          options={FILTERS.map((f) => ({
            value: f.value,
            label: f.label,
            count: f.value === status ? query.data?.count : undefined,
          }))}
        />
      </Container>

      {query.isLoading ? (
        <PageLoading />
      ) : query.isError ? (
        <Alert variant="error" role="alert">
          {errorMessage(query.error)}
        </Alert>
      ) : orders.length === 0 ? (
        <Text size="large" className="text-ui-fg-subtle px-1">
          {filter.empty}
        </Text>
      ) : (
        <>
          <Text size="large" className="text-ui-fg-subtle px-1" aria-live="polite">
            {plural(query.data!.count, "order")}
          </Text>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {orders.map((o) => (
              <DeliveryOrderCard key={o.id} order={o} />
            ))}
          </ul>
          <Pager offset={offset} limit={PAGE_SIZE} count={query.data!.count} onChange={setOffset} />
        </>
      )}
    </div>
  )
}
