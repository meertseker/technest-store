import { TriangleRightMini } from "@medusajs/icons"
import { Alert, Badge, Container, Heading, Text, clx } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { sdk } from "../../lib/client"
import { errorMessage, formatDate, plural, timeAgo } from "../../lib/format"
import type { TradeApplicationListResponse, TradeApplicationStatus } from "../../lib/types"
import { FilterChips, PageLoading, Pager, TAP } from "../shop-ui"
import { BUSINESS_TYPE_LABELS, TRADE_STATUS_COLORS, TRADE_STATUS_LABELS } from "./trade-shared"

// Trade account applications (docs/contracts/trade.md): the Trade tab of the
// Orders page, and (embedded) the waiting ones on Today.

const PAGE_SIZE = 20
type Filter = TradeApplicationStatus | "all"
const FILTERS: Filter[] = ["pending", "approved", "rejected", "all"]
const FILTER_LABELS: Record<Filter, string> = {
  pending: "Waiting",
  approved: "Approved",
  rejected: "Rejected",
  all: "All",
}

export const TRADE_QUERY_KEY = ["trade-applications"] as const

function useTradeList(status: Filter, offset: number, limit: number) {
  return useQuery({
    queryKey: [...TRADE_QUERY_KEY, "list", status, offset, limit],
    queryFn: () =>
      sdk.client.fetch<TradeApplicationListResponse>("/admin/trade-applications", {
        query: {
          limit,
          offset,
          // Oldest first while waiting, so nobody waits longest; newest first otherwise.
          order: status === "pending" ? "created_at" : "-created_at",
          ...(status !== "all" ? { status } : {}),
        },
      }),
    placeholderData: keepPreviousData,
  })
}

function TradeRows({ apps }: { apps: TradeApplicationListResponse["trade_applications"] }) {
  return (
    <ul className="divide-y" aria-label="Trade applications">
      {apps.map((a) => (
        <li key={a.id}>
          <Link
            to={`/trade-applications/${a.id}`}
            className="hover:bg-ui-bg-base-hover focus-visible:shadow-borders-interactive-with-focus flex min-h-11 items-center gap-3 px-4 py-3 outline-none md:px-6"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Text as="span" size="large" weight="plus" className="break-words">
                {a.company_name}
              </Text>
              <Text as="span" size="large" className="text-ui-fg-subtle">
                {a.contact.name} · {BUSINESS_TYPE_LABELS[a.business_type]}
              </Text>
              <Text as="span" size="small" className="text-ui-fg-muted">
                Applied {formatDate(a.created_at)} ({timeAgo(a.created_at)})
              </Text>
            </span>
            <Badge size="small" color={TRADE_STATUS_COLORS[a.status]}>
              {TRADE_STATUS_LABELS[a.status]}
            </Badge>
            <TriangleRightMini className="text-ui-fg-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export type TradeListProps = {
  /** Today: one status only, no heading or chips, at most `limit` rows. */
  embedded?: boolean
  status?: TradeApplicationStatus
  limit?: number
}

export const TradeList = ({ embedded, status = "pending", limit = 5 }: TradeListProps) => {
  if (embedded) return <EmbeddedTradeList status={status} limit={limit} />
  return <FullTradeList />
}

/** Renders nothing while empty. */
function EmbeddedTradeList({ status, limit }: { status: TradeApplicationStatus; limit: number }) {
  const { data, isLoading, isError, error } = useTradeList(status, 0, limit)
  if (isLoading) return <PageLoading />
  if (isError) {
    return (
      <Alert variant="error" role="alert">
        {errorMessage(error)}
      </Alert>
    )
  }
  const apps = data?.trade_applications ?? []
  if (!apps.length) return null
  return (
    <Container className="divide-y p-0">
      <TradeRows apps={apps} />
      {data!.count > apps.length && (
        <div className="px-4 py-3 md:px-6">
          <Link
            to="/shop-orders?tab=trade"
            className={clx(TAP, "text-ui-fg-interactive txt-large-plus inline-flex items-center underline-offset-2 hover:underline")}
          >
            See all {data!.count}
          </Link>
        </div>
      )}
    </Container>
  )
}

const FullTradeList = () => {
  const [params, setParams] = useSearchParams()
  const status = (FILTERS.includes(params.get("status") as Filter)
    ? params.get("status")
    : "pending") as Filter
  const [offset, setOffset] = useState(0)
  const { data, isLoading, isError, error } = useTradeList(status, offset, PAGE_SIZE)
  const apps = data?.trade_applications ?? []

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <Heading level="h2">Trade applications</Heading>
        <Text size="large" className="text-ui-fg-subtle">
          Businesses asking for trade prices. Approving one gives the customer trade prices when
          they are logged in.
        </Text>
        <FilterChips<Filter>
          label="Show applications"
          value={status}
          onChange={(s) => {
            setOffset(0)
            // Keep the page's other params (the open tab) and only change the filter.
            setParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                if (s === "pending") next.delete("status")
                else next.set("status", s)
                return next
              },
              { replace: true }
            )
          }}
          options={FILTERS.map((f) => ({ value: f, label: FILTER_LABELS[f] }))}
        />
      </div>

      {isLoading ? (
        <PageLoading />
      ) : isError ? (
        <div className="px-4 py-4 md:px-6">
          <Alert variant="error" role="alert">
            {errorMessage(error)}
          </Alert>
        </div>
      ) : apps.length === 0 ? (
        <Text size="large" className="text-ui-fg-subtle px-4 py-6 md:px-6">
          {status === "pending" ? "Nothing waiting for review." : "No applications here."}
        </Text>
      ) : (
        <>
          <Text size="large" className="text-ui-fg-subtle px-4 py-3 md:px-6" aria-live="polite">
            {plural(data!.count, "application")}
          </Text>
          <TradeRows apps={apps} />
          <Pager offset={offset} limit={PAGE_SIZE} count={data!.count} onChange={setOffset} />
        </>
      )}
    </Container>
  )
}
