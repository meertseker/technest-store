import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Buildings, TriangleRightMini } from "@medusajs/icons"
import { Alert, Badge, Container, Heading, Text } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { FilterChips, PageLoading, Pager } from "../../components/shop-ui"
import { sdk } from "../../lib/client"
import { errorMessage, formatDate, plural, timeAgo } from "../../lib/format"
import type { TradeApplicationListResponse, TradeApplicationStatus } from "../../lib/types"
import { BUSINESS_TYPE_LABELS, TRADE_STATUS_COLORS, TRADE_STATUS_LABELS } from "./shared"

// Trade account applications (docs/contracts/trade.md). Opens on "Waiting".

const PAGE_SIZE = 20
type Filter = TradeApplicationStatus | "all"
const FILTERS: Filter[] = ["pending", "approved", "rejected", "all"]
const FILTER_LABELS: Record<Filter, string> = {
  pending: "Waiting",
  approved: "Approved",
  rejected: "Rejected",
  all: "All",
}

const TradeApplicationsPage = () => {
  const [params, setParams] = useSearchParams()
  const status = (FILTERS.includes(params.get("status") as Filter)
    ? params.get("status")
    : "pending") as Filter
  const [offset, setOffset] = useState(0)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["trade-applications", "list", status, offset],
    queryFn: () =>
      sdk.client.fetch<TradeApplicationListResponse>("/admin/trade-applications", {
        query: {
          limit: PAGE_SIZE,
          offset,
          // Oldest first while waiting, so nobody waits longest; newest first otherwise.
          order: status === "pending" ? "created_at" : "-created_at",
          ...(status !== "all" ? { status } : {}),
        },
      }),
    placeholderData: keepPreviousData,
  })

  const apps = data?.trade_applications ?? []

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <Heading level="h1">Trade applications</Heading>
        <Text size="large" className="text-ui-fg-subtle">
          Businesses asking for trade prices. Approving one gives the customer trade prices when
          they are logged in.
        </Text>
        <FilterChips<Filter>
          label="Show applications"
          value={status}
          onChange={(s) => {
            setOffset(0)
            setParams(s === "pending" ? {} : { status: s }, { replace: true })
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
          <Pager offset={offset} limit={PAGE_SIZE} count={data!.count} onChange={setOffset} />
        </>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Trade applications",
  icon: Buildings,
  rank: 4,
})

export default TradeApplicationsPage
