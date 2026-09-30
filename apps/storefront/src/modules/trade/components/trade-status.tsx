import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import StatusBadge from "@/components/ui/status-badge"
import { formatOrderDate } from "@/lib/account/orders"
import { TRADE_STATUS_COPY } from "@/lib/trade/format"
import type { TradeApplication } from "@/lib/trade/types"
import { BUSINESS_TYPES } from "@/lib/forms/validation"

/** The customer's latest trade application (GET /store/trade-applications/me) */
export default function TradeStatus({
  application,
  headingLevel = 2,
  showActions = true,
}: {
  application: TradeApplication
  headingLevel?: 2 | 3
  showActions?: boolean
}) {
  const copy = TRADE_STATUS_COPY[application.status]
  const H = `h${headingLevel}` as "h2" | "h3"
  const businessType = BUSINESS_TYPES.find(
    (b) => b.value === application.business_type
  )?.label

  return (
    <section
      aria-labelledby="trade-status-title"
      className="rounded border border-border p-4 lg:p-6"
      data-testid="trade-status"
    >
      <StatusBadge tone={copy.tone}>{copy.label}</StatusBadge>
      <H
        id="trade-status-title"
        className="mt-3 text-[22px] font-semibold leading-tight"
      >
        {copy.title}
      </H>
      <p className="mt-2 max-w-[68ch]">{copy.body}</p>
      {application.status === "rejected" && application.reason && (
        <div className="mt-4 rounded bg-surface p-4">
          <p className="font-semibold">Our reason</p>
          <p className="mt-1 whitespace-pre-line">{application.reason}</p>
        </div>
      )}

      <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        <dt className="text-muted-foreground">Business</dt>
        <dd className="font-semibold">{application.company_name}</dd>
        {businessType && (
          <>
            <dt className="text-muted-foreground">Type</dt>
            <dd>{businessType}</dd>
          </>
        )}
        {application.vat_number && (
          <>
            <dt className="text-muted-foreground">VAT number</dt>
            <dd>{application.vat_number}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Applied on</dt>
        <dd>{formatOrderDate(application.created_at)}</dd>
      </dl>

      {showActions && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row empty:hidden">
          {application.status === "approved" && (
            <Link
              href="/"
              className={buttonVariants({ className: "w-full sm:w-auto" })}
            >
              Shop with trade prices
            </Link>
          )}
          {application.status === "rejected" && (
            <Link
              href="/trade/apply"
              className={buttonVariants({ className: "w-full sm:w-auto" })}
            >
              Apply again
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
