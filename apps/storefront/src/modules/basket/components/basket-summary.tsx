import { Lock } from "lucide-react"
import { HttpTypes } from "@medusajs/types"
import { buttonVariants } from "@/components/ui/button"
import { formatGbp, formatPenceExact, toPence } from "@lib/basket/money"
import { cheapestDeliveryPence } from "@lib/basket/shipping-options"
import type { BasketView } from "@lib/data/basket"
import KlarnaBasketHint from "@modules/checkout/payment/klarna-basket-hint"

/** "Delivery from £3.49 · Click & Collect free" (no drip pricing: shown before checkout) */
export function deliveryLine(view: Pick<BasketView, "choices" | "addon_only">): string {
  const hasCollect = view.choices.some((c) => c.kind === "collect")
  const collect = hasCollect ? "Click & Collect free" : null
  if (view.addon_only) return collect ?? "Delivery options at checkout"
  const cheapest = cheapestDeliveryPence(view.choices)
  const delivery =
    cheapest === null ? null : cheapest === 0 ? "Free standard delivery" : `Delivery from ${formatPenceExact(cheapest)}`
  const parts = [delivery, collect].filter(Boolean)
  return parts.length ? parts.join(" / ") : "Delivery options at checkout"
}

/**
 * Subtotal, delivery line and the one primary action. "Checkout securely" is a
 * plain <a>: /checkout must be a full page load so its Stripe-only CSP applies.
 */
export default function BasketSummary({
  cart,
  view,
}: {
  cart: HttpTypes.StoreCart
  view: BasketView
}) {
  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="font-semibold">
            Subtotal <span className="font-normal text-muted-foreground">(inc. VAT)</span>
          </dt>
          <dd className="text-lg font-bold tabular-nums" data-testid="basket-subtotal">
            {formatGbp(cart.item_total)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 text-muted-foreground">
          <dt className="sr-only">Delivery</dt>
          <dd data-testid="basket-delivery-line">{deliveryLine(view)}</dd>
        </div>
      </dl>
      <a
        href="/checkout"
        className={buttonVariants({ size: "lg", className: "w-full" })}
        data-testid="checkout-button"
      >
        <Lock aria-hidden />
        Checkout securely
      </a>
      <p className="text-center text-muted-foreground">
        Secure card payment by Stripe · 14-day returns
      </p>
      {/* E2's payment footnote: 14px small print (spec 3), marked for the quality-gate e2e */}
      <div data-small-text className="empty:hidden">
        <KlarnaBasketHint total_pence={toPence(cart.total ?? cart.item_total)} min_pence={view.klarna_min_basket_pence} />
      </div>
    </div>
  )
}
