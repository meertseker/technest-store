import Link from "next/link"
import { HttpTypes } from "@medusajs/types"
import { formatGbp } from "@lib/basket/money"
import LineControls from "./line-controls"
import LineThumb from "./line-thumb"

/** Newest first, so the item just added is at the top */
export function sortLines(items: HttpTypes.StoreCartLineItem[] | undefined) {
  return [...(items ?? [])].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  )
}

/** Line items: thumb, title, variant, price, 44px stepper and Remove (spec 7.4) */
export default function BasketLines({ items }: { items: HttpTypes.StoreCartLineItem[] | undefined }) {
  return (
    <ul className="flex flex-col divide-y divide-border" data-testid="basket-lines">
      {sortLines(items).map((item) => {
        const title = item.product_title ?? item.title
        const variant =
          item.variant_title && item.variant_title !== "Default variant" && item.variant_title !== title
            ? item.variant_title
            : null
        return (
          <li key={item.id} className="flex gap-3 py-4 first:pt-0" data-testid="basket-line">
            <LineThumb src={item.thumbnail} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {item.product_handle ? (
                    <Link
                      href={`/products/${item.product_handle}`}
                      className="font-semibold leading-snug hover:underline"
                    >
                      {title}
                    </Link>
                  ) : (
                    <p className="font-semibold leading-snug">{title}</p>
                  )}
                  {variant && <p className="text-sm text-muted-foreground">{variant}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums">{formatGbp(item.total)}</p>
                  {item.quantity > 1 && (
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {formatGbp(item.unit_price)} each
                    </p>
                  )}
                </div>
              </div>
              <LineControls lineId={item.id} title={title} quantity={item.quantity} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
