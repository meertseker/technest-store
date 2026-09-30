import { ChevronDown } from "lucide-react"
import { HttpTypes } from "@medusajs/types"
import { formatGbp } from "@lib/basket/money"
import LineThumb from "@modules/basket/components/line-thumb"
import { sortLines } from "@modules/basket/components/basket-lines"

type Totals = {
  item_total?: number | null
  shipping_total?: number | null
  discount_total?: number | null
  tax_total?: number | null
  total?: number | null
}

/** Items + totals. Prices include VAT, so VAT is an "includes" line, not an addition. */
export function SummaryBody({
  items,
  totals,
  deliveryChosen,
}: {
  items: HttpTypes.StoreCartLineItem[] | HttpTypes.StoreOrderLineItem[] | undefined
  totals: Totals
  deliveryChosen: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {sortLines(items as HttpTypes.StoreCartLineItem[]).map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <div className="relative">
              <LineThumb src={item.thumbnail} size={56} />
              <span
                aria-hidden
                className="absolute -right-2 -top-2 min-w-6 rounded-full bg-foreground px-1.5 text-center text-sm font-semibold leading-6 text-background"
              >
                {item.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{item.product_title ?? item.title}</p>
              <p className="text-muted-foreground">
                {item.variant_title && item.variant_title !== "Default variant" ? `${item.variant_title} · ` : ""}
                Qty {item.quantity}
              </p>
            </div>
            <p className="font-semibold tabular-nums">{formatGbp(item.total)}</p>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-2 border-t border-border pt-4">
        <div className="flex justify-between gap-4">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{formatGbp(totals.item_total)}</dd>
        </div>
        {!!totals.discount_total && (
          <div className="flex justify-between gap-4">
            <dt>Discount</dt>
            <dd className="tabular-nums">-{formatGbp(totals.discount_total)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt>Delivery</dt>
          <dd className="tabular-nums" data-testid="summary-shipping-cost">
            {!deliveryChosen
              ? "Chosen in step 2"
              : totals.shipping_total
              ? formatGbp(totals.shipping_total)
              : "Free"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
          <dt className="text-lg font-bold">Total</dt>
          <dd className="text-lg font-bold tabular-nums" data-testid="summary-total">
            {formatGbp(totals.total)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 text-sm text-muted-foreground" data-small-text>
          <dt>Includes VAT</dt>
          <dd className="tabular-nums">{formatGbp(totals.tax_total)}</dd>
        </div>
      </dl>
    </div>
  )
}

/** Mobile: a collapsed bar above the steps (native <details>, works without JS) */
export function MobileOrderSummary({
  cart,
  deliveryChosen,
}: {
  cart: HttpTypes.StoreCart
  deliveryChosen: boolean
}) {
  return (
    <details className="group border-b border-border bg-surface lg:hidden" data-testid="mobile-summary">
      <summary className="content-container flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-semibold">
          <span className="group-open:hidden">Show order summary</span>
          <span className="hidden group-open:inline">Hide order summary</span>
          <ChevronDown aria-hidden className="size-5 transition-transform duration-150 group-open:rotate-180" />
        </span>
        <span className="text-lg font-bold tabular-nums">{formatGbp(cart.total)}</span>
      </summary>
      <div className="content-container pb-6 pt-2">
        <SummaryBody items={cart.items} totals={cart} deliveryChosen={deliveryChosen} />
      </div>
    </details>
  )
}

/** Desktop: sticky right column */
export function DesktopOrderSummary({
  cart,
  deliveryChosen,
}: {
  cart: HttpTypes.StoreCart
  deliveryChosen: boolean
}) {
  return (
    <aside
      aria-labelledby="order-summary-title"
      className="hidden lg:col-span-5 lg:block"
      data-testid="desktop-summary"
    >
      <div className="sticky top-6 rounded border border-border bg-surface p-6">
        <h2 id="order-summary-title" className="mb-4 text-xl font-semibold">
          Order summary
        </h2>
        <SummaryBody items={cart.items} totals={cart} deliveryChosen={deliveryChosen} />
      </div>
    </aside>
  )
}
