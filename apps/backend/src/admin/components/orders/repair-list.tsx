import { TriangleRightMini } from "@medusajs/icons"
import { Alert, Badge, Container, Heading, Text, clx } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { sdk } from "../../lib/client"
import { errorMessage, formatDateTime, plural, timeAgo } from "../../lib/format"
import { REPAIR_STATUSES, RepairBookingListResponse, RepairBookingStatus } from "../../lib/types"
import { FilterChips, PageLoading, Pager, TAP } from "../shop-ui"
import { REPAIR_STATUS_COLORS, REPAIR_STATUS_LABELS } from "./repair-shared"

// Repair requests from the website (docs/contracts/repairs.md): the Repairs tab
// of the Orders page, and (embedded) the "To call back" ones on Today.

const PAGE_SIZE = 20
type Filter = RepairBookingStatus | "all"
const FILTERS: Filter[] = [...REPAIR_STATUSES, "all"]

export const REPAIR_QUERY_KEY = ["repair-bookings"] as const

function useRepairList(status: Filter, offset: number, limit: number) {
  return useQuery({
    queryKey: [...REPAIR_QUERY_KEY, "list", status, offset, limit],
    queryFn: () =>
      sdk.client.fetch<RepairBookingListResponse>("/admin/repair-bookings", {
        query: {
          limit,
          offset,
          // Call back the longest-waiting customer first.
          order: status === "new" ? "created_at" : "-created_at",
          ...(status !== "all" ? { status } : {}),
        },
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })
}

function RepairRows({ bookings }: { bookings: RepairBookingListResponse["repair_bookings"] }) {
  return (
    <ul className="divide-y" aria-label="Repair bookings">
      {bookings.map((b) => (
        <li key={b.id}>
          <Link
            to={`/repair-bookings/${b.id}`}
            className="hover:bg-ui-bg-base-hover focus-visible:shadow-borders-interactive-with-focus flex min-h-11 items-center gap-3 px-4 py-3 outline-none md:px-6"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Text as="span" size="large" weight="plus" className="break-words">
                {b.device} · {b.name}
              </Text>
              <Text as="span" size="large" className="text-ui-fg-subtle line-clamp-2">
                {b.fault}
              </Text>
              <Text as="span" size="small" className="text-ui-fg-muted">
                Sent {formatDateTime(b.created_at)} ({timeAgo(b.created_at)}) · Best time:{" "}
                {b.preferred_time}
              </Text>
            </span>
            <Badge size="small" color={REPAIR_STATUS_COLORS[b.status]}>
              {REPAIR_STATUS_LABELS[b.status]}
            </Badge>
            <TriangleRightMini className="text-ui-fg-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export type RepairListProps = {
  /** Today: one status only, no heading or chips, at most `limit` rows. */
  embedded?: boolean
  status?: RepairBookingStatus
  limit?: number
}

export const RepairList = ({ embedded, status = "new", limit = 5 }: RepairListProps) => {
  if (embedded) return <EmbeddedRepairList status={status} limit={limit} />
  return <FullRepairList />
}

/** Renders nothing while empty. */
function EmbeddedRepairList({ status, limit }: { status: RepairBookingStatus; limit: number }) {
  const { data, isLoading, isError, error } = useRepairList(status, 0, limit)
  if (isLoading) return <PageLoading />
  if (isError) {
    return (
      <Alert variant="error" role="alert">
        {errorMessage(error)}
      </Alert>
    )
  }
  const bookings = data?.repair_bookings ?? []
  if (!bookings.length) return null
  return (
    <Container className="divide-y p-0">
      <RepairRows bookings={bookings} />
      {data!.count > bookings.length && (
        <div className="px-4 py-3 md:px-6">
          <Link
            to="/shop-orders?tab=repairs"
            className={clx(TAP, "text-ui-fg-interactive txt-large-plus inline-flex items-center underline-offset-2 hover:underline")}
          >
            See all {data!.count}
          </Link>
        </div>
      )}
    </Container>
  )
}

const FullRepairList = () => {
  const [params, setParams] = useSearchParams()
  const status = (FILTERS.includes(params.get("status") as Filter)
    ? params.get("status")
    : "new") as Filter
  const [offset, setOffset] = useState(0)
  const { data, isLoading, isError, error } = useRepairList(status, offset, PAGE_SIZE)
  const bookings = data?.repair_bookings ?? []

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <Heading level="h2">Repair bookings</Heading>
        <Text size="large" className="text-ui-fg-subtle">
          Repair requests from the website. Call the customer back, then mark it booked in.
        </Text>
        <FilterChips<Filter>
          label="Show bookings"
          value={status}
          onChange={(s) => {
            setOffset(0)
            // Keep the page's other params (the open tab) and only change the filter.
            setParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                if (s === "new") next.delete("status")
                else next.set("status", s)
                return next
              },
              { replace: true }
            )
          }}
          options={FILTERS.map((f) => ({
            value: f,
            label: f === "all" ? "All" : REPAIR_STATUS_LABELS[f],
          }))}
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
      ) : bookings.length === 0 ? (
        <Text size="large" className="text-ui-fg-subtle px-4 py-6 md:px-6">
          {status === "new" ? "Nobody is waiting for a call back." : "No bookings here."}
        </Text>
      ) : (
        <>
          <Text size="large" className="text-ui-fg-subtle px-4 py-3 md:px-6" aria-live="polite">
            {plural(data!.count, "booking")}
          </Text>
          <RepairRows bookings={bookings} />
          <Pager offset={offset} limit={PAGE_SIZE} count={data!.count} onChange={setOffset} />
        </>
      )}
    </Container>
  )
}
