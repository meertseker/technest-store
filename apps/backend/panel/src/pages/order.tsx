import { ArrowLeft } from "@medusajs/icons"
import { Alert, Badge, Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { COLLECT_QUERY_KEY } from "../../../src/admin/components/orders/collect-board"
import { DELIVERY_QUERY_KEY } from "../../../src/admin/components/orders/delivery-list"
import { ConfirmDialog, DetailRow, PageLoading, TAP, Thumb } from "../../../src/admin/components/shop-ui"
import { sdk } from "../../../src/admin/lib/client"
import { errorMessage, formatDateTime, formatPence } from "../../../src/admin/lib/format"
import {
  canCancel,
  describePayment,
  parseRefund,
  summarisePayments,
  toPence,
  type PanelOrder,
} from "../../../src/admin/lib/order-detail"

// One order, for the shop: what to do next, the money (refund, cancel), the
// items and the customer. Deliberately no "Capture payment": a Click & Collect
// payment is taken by Collected, a delivery payment straight after the order.

const ORDER_FIELDS = [
  "id",
  "display_id",
  "status",
  "created_at",
  "email",
  "total",
  "original_total",
  "item_total",
  "shipping_total",
  "payment_status",
  "fulfillment_status",
  "metadata",
  "*items",
  "*shipping_address",
  "*shipping_methods",
  "*payment_collections",
  "*payment_collections.payments",
  "*payment_collections.payments.captures",
  "*payment_collections.payments.refunds",
].join(",")

type Address = {
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  postal_code?: string | null
  phone?: string | null
}

type Order = PanelOrder & {
  id: string
  display_id: number
  created_at: string
  email: string | null
  total: number | string
  /** Before refunds; `total` drops as money is refunded. */
  original_total?: number | string | null
  item_total: number | string
  shipping_total: number | string
  metadata?: Record<string, unknown> | null
  items?: {
    id: string
    title: string
    product_title?: string | null
    variant_title?: string | null
    thumbnail?: string | null
    quantity: number
    total?: number | string
  }[]
  shipping_address?: Address | null
  shipping_methods?: { name?: string | null; shipping_option_id?: string | null }[]
}

type ShippingOptionRow = { id: string; type?: { code?: string | null } | null; service_zone?: { fulfillment_set?: { type?: string | null } | null } | null }

const PAYMENT_LABELS: Record<string, { label: string; color: "green" | "orange" | "grey" | "red" | "blue" }> = {
  authorized: { label: "Card held", color: "orange" },
  partially_authorized: { label: "Card held", color: "orange" },
  captured: { label: "Paid", color: "green" },
  partially_captured: { label: "Part paid", color: "green" },
  partially_refunded: { label: "Part refunded", color: "blue" },
  refunded: { label: "Refunded", color: "blue" },
  canceled: { label: "Card released", color: "grey" },
  not_paid: { label: "Not paid", color: "red" },
  awaiting: { label: "Waiting for payment", color: "orange" },
  requires_action: { label: "Waiting for customer", color: "orange" },
}

export function PaymentBadge({ status }: { status: string | null | undefined }) {
  const s = PAYMENT_LABELS[status ?? ""] ?? { label: status ?? "Unknown", color: "grey" as const }
  return <Badge color={s.color}>{s.label}</Badge>
}

const fullName = (a?: Address | null) => [a?.first_name, a?.last_name].filter(Boolean).join(" ")

export function OrderPage() {
  const { id = "" } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const key = ["panel", "order", id]

  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: key,
    queryFn: async () => (await sdk.client.fetch<{ order: Order }>(`/admin/orders/${id}`, { query: { fields: ORDER_FIELDS } })).order,
  })

  const optionIds = (order?.shipping_methods ?? []).map((m) => m.shipping_option_id).filter((x): x is string => !!x)
  const { data: pickup } = useQuery({
    queryKey: ["panel", "order-pickup", optionIds],
    enabled: !!order,
    queryFn: async () => {
      // Same rule as the backend (lib/basket-rules isPickupOption); the method's name as a fallback.
      const byName = (order?.shipping_methods ?? []).some((m) => /collect/i.test(m.name ?? ""))
      if (!optionIds.length) return byName
      try {
        const { shipping_options } = await sdk.client.fetch<{ shipping_options: ShippingOptionRow[] }>(
          "/admin/shipping-options",
          { query: { id: optionIds, fields: "id,type.code,service_zone.fulfillment_set.type" } }
        )
        return shipping_options.some((o) => o.service_zone?.fulfillment_set?.type === "pickup" || o.type?.code === "click-collect") || byName
      } catch {
        return byName
      }
    },
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key })
    queryClient.invalidateQueries({ queryKey: COLLECT_QUERY_KEY })
    queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEY })
    queryClient.invalidateQueries({ queryKey: ["panel", "orders"] })
  }

  if (isLoading) return <PageLoading />
  if (isError || !order) {
    return (
      <Container className="px-4 py-6">
        <Text size="large" role="alert">
          {errorMessage(error, "Couldn't load this order.")}
        </Text>
      </Container>
    )
  }

  const summary = summarisePayments(order)
  const name = fullName(order.shipping_address)
  const meta = order.metadata ?? {}
  const isPickup = !!pickup

  return (
    <div className="flex flex-col gap-4">
      <Link to="/shop-orders" className="txt-large text-ui-fg-interactive inline-flex min-h-11 items-center gap-1 self-start">
        <ArrowLeft /> Orders
      </Link>

      <Container className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-1">
          <Heading level="h1">Order #{order.display_id}</Heading>
          <Text size="large" className="text-ui-fg-subtle">
            {formatDateTime(order.created_at)} · {isPickup ? "Click & Collect" : "Delivery"}
          </Text>
        </div>
        {order.status === "canceled" ? <Badge color="grey">Cancelled</Badge> : <PaymentBadge status={order.payment_status} />}
      </Container>

      <NextStep order={order} isPickup={isPickup} meta={meta} onDone={refresh} />
      <Money order={order} isPickup={isPickup} onDone={refresh} summary={summary} />

      <Container className="divide-y p-0">
        <Heading level="h2" className="px-4 py-3 md:px-6">
          Items
        </Heading>
        <ul>
          {(order.items ?? []).map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3 md:px-6">
              <Thumb src={item.thumbnail} />
              <div className="flex min-w-0 flex-1 flex-col">
                <Text size="large" weight="plus">
                  {item.product_title || item.title}
                </Text>
                {item.variant_title && item.variant_title !== "Default" && (
                  <Text size="large" className="text-ui-fg-subtle">
                    {item.variant_title}
                  </Text>
                )}
              </div>
              <Text size="large">× {item.quantity}</Text>
              <Text size="large" weight="plus" className="w-20 text-right">
                {formatPence(toPence(item.total))}
              </Text>
            </li>
          ))}
        </ul>
        <DetailRow label="Delivery">{formatPence(toPence(order.shipping_total))}</DetailRow>
        <DetailRow label="Total">
          <Text size="large" weight="plus">
            {formatPence(toPence(order.original_total ?? order.total))}
          </Text>
        </DetailRow>
      </Container>

      <Container className="divide-y p-0">
        <Heading level="h2" className="px-4 py-3 md:px-6">
          Customer
        </Heading>
        <DetailRow label="Name">{name || "Not given"}</DetailRow>
        <DetailRow label="Email">
          {order.email ? (
            <a href={`mailto:${order.email}`} className="txt-large text-ui-fg-interactive break-all underline">
              {order.email}
            </a>
          ) : (
            "Not given"
          )}
        </DetailRow>
        <DetailRow label="Phone">
          {order.shipping_address?.phone ? (
            <a href={`tel:${order.shipping_address.phone}`} className="txt-large text-ui-fg-interactive underline">
              {order.shipping_address.phone}
            </a>
          ) : (
            "Not given"
          )}
        </DetailRow>
        {!isPickup && (
          <DetailRow label="Address">
            {[
              order.shipping_address?.address_1,
              order.shipping_address?.address_2,
              order.shipping_address?.city,
              order.shipping_address?.postal_code,
            ]
              .filter(Boolean)
              .join(", ") || "Not given"}
          </DetailRow>
        )}
      </Container>

      <a
        href={`/app/orders/${order.id}`}
        className="txt-medium text-ui-fg-subtle inline-flex min-h-11 items-center self-start underline-offset-2 hover:underline"
      >
        Open in the full admin (returns, exchanges, notes)
      </a>
    </div>
  )
}

function NextStep({
  order,
  isPickup,
  meta,
  onDone,
}: {
  order: Order
  isPickup: boolean
  meta: Record<string, unknown>
  onDone: () => void
}) {
  const [confirm, setConfirm] = useState<"ready" | "collected" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const act = useMutation({
    mutationFn: (action: "ready" | "collected" | "resend-ready") =>
      sdk.client.fetch<{ order: { collection_code?: string | null } }>(`/admin/click-collect/orders/${order.id}/${action}`, {
        method: "POST",
      }),
    onMutate: () => setError(null),
    onSuccess: (r, action) => {
      toast.success(
        action === "ready"
          ? `Marked ready. The customer has been emailed code ${r.order.collection_code ?? ""}.`
          : action === "collected"
            ? "Collected. The payment has been taken."
            : "The ready email was sent again."
      )
      onDone()
    },
    onError: (e) => {
      setError(errorMessage(e))
      onDone()
    },
  })

  const money = summarisePayments(order)
  let body: ReactNode
  if (order.status === "canceled") {
    body = <Text size="large">This order was cancelled. Nothing more to do.</Text>
  } else if (money.captured_pence > 0 && money.refunded_pence >= money.captured_pence) {
    body = <Text size="large">Refunded in full. Nothing to hand over or send.</Text>
  } else if (isPickup) {
    const code = typeof meta.collection_code === "string" ? meta.collection_code : null
    const readyAt = typeof meta.ready_for_collection_at === "string" ? meta.ready_for_collection_at : null
    const collectedAt = typeof meta.collected_at === "string" ? meta.collected_at : null
    if (collectedAt) {
      body = <Text size="large">Collected {formatDateTime(collectedAt)}. Nothing more to do.</Text>
    } else if (!readyAt) {
      body = (
        <div className="flex flex-col gap-3">
          <Text size="large">
            1. Get the items ready. 2. Press <strong>Mark ready</strong>: the customer gets an email with a collection code.
          </Text>
          <Button size="large" className={TAP} isLoading={act.isPending} onClick={() => setConfirm("ready")}>
            Mark ready
          </Button>
        </div>
      )
    } else {
      body = (
        <div className="flex flex-col gap-3">
          <Text size="large">
            On the shelf since {formatDateTime(readyAt)}. When the customer comes in, check their code, hand the items over and
            press <strong>Collected</strong>. That takes the payment.
          </Text>
          {code && (
            <p className="text-ui-fg-base font-mono text-4xl font-semibold tracking-[0.2em]" aria-label={`Collection code ${code.split("").join(" ")}`}>
              {code}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="large" className={TAP} isLoading={act.isPending} onClick={() => setConfirm("collected")}>
              Collected
            </Button>
            <Button size="large" variant="secondary" className={TAP} disabled={act.isPending} onClick={() => act.mutate("resend-ready")}>
              Send the ready email again
            </Button>
          </div>
        </div>
      )
    }
  } else if (order.fulfillment_status === "shipped" || order.fulfillment_status === "delivered") {
    body = <Text size="large">Sent. Nothing more to do.</Text>
  } else {
    body = (
      <div className="flex flex-col gap-3">
        <Text size="large">Pack the items, post them, then press Packed & shipped on the Delivery list (you can add a tracking number).</Text>
        <Link
          to="/shop-orders?tab=delivery"
          className="bg-ui-button-inverted text-ui-contrast-fg-primary txt-large-plus inline-flex min-h-11 items-center justify-center self-start rounded-md px-4"
        >
          Open the Delivery list
        </Link>
      </div>
    )
  }

  const total = formatPence(money.held_pence || toPence(order.total))
  return (
    <Container className="flex flex-col gap-3 px-4 py-4 md:px-6">
      <Heading level="h2">What to do next</Heading>
      {body}
      {error && (
        <Alert variant="error" role="alert">
          {error}
        </Alert>
      )}
      <ConfirmDialog
        open={confirm === "ready"}
        title="Mark this order ready?"
        description="The customer gets an email saying it's ready, with their collection code."
        confirmText="Mark ready"
        onConfirm={() => {
          setConfirm(null)
          act.mutate("ready")
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "collected"}
        title="Has the customer got the items?"
        description={`This takes ${total} from their card and closes the order.`}
        confirmText="Yes, collected"
        onConfirm={() => {
          setConfirm(null)
          act.mutate("collected")
        }}
        onCancel={() => setConfirm(null)}
      />
    </Container>
  )
}

function Money({
  order,
  isPickup,
  summary,
  onDone,
}: {
  order: Order
  isPickup: boolean
  summary: ReturnType<typeof summarisePayments>
  onDone: () => void
}) {
  const [refunding, setRefunding] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [amount, setAmount] = useState("")
  const [amountError, setAmountError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refund = useMutation({
    mutationFn: (pence: number) =>
      sdk.client.fetch(`/admin/payments/${summary.refund_payment_id}/refund`, {
        method: "POST",
        body: { amount: pence / 100, note: "Refunded from the shop panel" },
      }),
    onMutate: () => setError(null),
    onSuccess: (_r, pence) => {
      toast.success(`${formatPence(pence)} refunded. It reaches the card in 5 to 10 days.`)
      onDone()
    },
    onError: (e) => {
      setError(errorMessage(e))
      onDone()
    },
  })

  const cancel = useMutation({
    mutationFn: () => sdk.client.fetch(`/admin/orders/${order.id}/cancel`, { method: "POST" }),
    onMutate: () => setError(null),
    onSuccess: () => {
      toast.success("Order cancelled. The card hold has been released.")
      onDone()
    },
    onError: (e) => {
      setError(errorMessage(e))
      onDone()
    },
  })

  const showCancel = canCancel(order, summary)

  return (
    <Container className="flex flex-col gap-3 px-4 py-4 md:px-6">
      <Heading level="h2">Money</Heading>
      <Text size="large">{describePayment(summary, isPickup)}</Text>
      {(summary.refundable_pence > 0 || showCancel) && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {summary.refundable_pence > 0 && (
            <Button
              size="large"
              variant="secondary"
              className={TAP}
              isLoading={refund.isPending}
              onClick={() => {
                setAmount((summary.refundable_pence / 100).toFixed(2))
                setAmountError(null)
                setRefunding(true)
              }}
            >
              Refund
            </Button>
          )}
          {showCancel && (
            <Button size="large" variant="danger" className={TAP} isLoading={cancel.isPending} onClick={() => setCancelling(true)}>
              Cancel order
            </Button>
          )}
        </div>
      )}
      {error && (
        <Alert variant="error" role="alert">
          {error}
        </Alert>
      )}

      <ConfirmDialog
        open={refunding}
        variant="danger"
        title="Refund this order?"
        description={`Up to ${formatPence(summary.refundable_pence)} can go back to the customer's card. This can't be undone.`}
        confirmText="Refund"
        onConfirm={() => {
          const parsed = parseRefund(amount, summary.refundable_pence)
          if ("error" in parsed) {
            setAmountError(parsed.error)
            return false
          }
          setRefunding(false)
          refund.mutate(parsed.pence)
        }}
        onCancel={() => setRefunding(false)}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="refund-amount" size="base" weight="plus">
            Amount in pounds
          </Label>
          <Input
            id="refund-amount"
            inputMode="decimal"
            size="base"
            className={TAP}
            value={amount}
            aria-invalid={!!amountError}
            aria-describedby={amountError ? "refund-amount-error" : undefined}
            onChange={(e) => {
              setAmount(e.target.value)
              setAmountError(null)
            }}
          />
          {amountError && (
            <Text id="refund-amount-error" size="base" className="text-ui-fg-error">
              {amountError}
            </Text>
          )}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelling}
        variant="danger"
        title="Cancel this order?"
        description="The customer's card hold is released (no money is taken) and the items go back into stock. This can't be undone."
        confirmText="Cancel order"
        cancelText="Keep the order"
        onConfirm={() => {
          setCancelling(false)
          cancel.mutate()
        }}
        onCancel={() => setCancelling(false)}
      />
    </Container>
  )
}
