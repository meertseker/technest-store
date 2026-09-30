import Image from "next/image"
import Link from "next/link"
import { ChevronRight, Package } from "lucide-react"
import { HttpTypes } from "@medusajs/types"
import StatusBadge from "@/components/ui/status-badge"
import { formatMoney, formatOrderDate, isClickAndCollect, orderStatus } from "@/lib/account/orders"

/** One order in a list: the whole card is one link (one tab stop) */
export default function OrderCard({ order }: { order: HttpTypes.StoreOrder }) {
  const status = orderStatus(order)
  const items = order.items ?? []
  const count = items.reduce((n, i) => n + (i.quantity ?? 0), 0)
  const thumbs = items.filter((i) => i.thumbnail).slice(0, 3)

  return (
    <Link
      href={`/account/orders/${order.id}`}
      className="group flex items-center gap-4 rounded border border-border p-4 transition-colors duration-150 hover:bg-surface"
      data-testid="order-card"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            Order #{order.display_id}
            <span className="font-normal text-muted-foreground"> · {formatOrderDate(order.created_at as string)}</span>
          </p>
          <p className="text-muted-foreground">
            {count} {count === 1 ? "item" : "items"} · {isClickAndCollect(order) ? "Click & Collect" : "Delivery"} ·{" "}
            <span className="tabular-nums text-foreground">{formatMoney(order.total, order.currency_code)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {thumbs.length > 0 ? (
            <div className="hidden -space-x-3 sm:flex" aria-hidden>
              {thumbs.map((i) => (
                <Image
                  key={i.id}
                  src={i.thumbnail!}
                  alt=""
                  width={48}
                  height={48}
                  className="size-12 rounded border-2 border-background bg-surface object-contain"
                />
              ))}
            </div>
          ) : (
            <Package aria-hidden className="hidden size-6 text-muted-foreground sm:block" />
          )}
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
      </div>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
    </Link>
  )
}
