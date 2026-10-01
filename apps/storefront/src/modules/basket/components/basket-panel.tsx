import { CircleCheck } from "lucide-react"
import { HttpTypes } from "@medusajs/types"
import { toPence } from "@lib/basket/money"
import type { BasketView } from "@lib/data/basket"
import AddonNotice from "./addon-notice"
import BasketEmpty from "./basket-empty"
import BasketLines from "./basket-lines"
import BasketSummary from "./basket-summary"
import FreeDeliveryBar from "./free-delivery-bar"

export function itemCount(cart: HttpTypes.StoreCart | null | undefined) {
  return cart?.items?.reduce((n, i) => n + i.quantity, 0) ?? 0
}

/**
 * Drawer body (spec 7.4, 375 and 1280): free-delivery bar, add-on notice,
 * lines, then a sticky footer with the summary. The heading is passed in so the
 * drawer can use the dialog title and /basket an <h1>. `justAdded` shows the
 * "Added to basket" confirmation in the flow, so it never covers anything.
 */
export default function BasketPanel({
  cart,
  view,
  heading,
  justAdded,
}: {
  cart: HttpTypes.StoreCart | null
  view: BasketView
  heading: React.ReactNode
  justAdded?: boolean
}) {
  const count = itemCount(cart)
  return (
    <div className="flex h-full flex-col" data-testid="basket-panel">
      <div className="border-b border-border px-4 py-3 pr-16">{heading}</div>
      {cart && count > 0 ? (
        <>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            {justAdded && (
              <p
                className="flex items-center gap-2 rounded bg-success-subtle px-3 py-2 font-semibold text-success"
                data-testid="basket-added"
              >
                <CircleCheck aria-hidden className="size-5 shrink-0" />
                Added to basket
              </p>
            )}
            <FreeDeliveryBar
              subtotal_pence={toPence(cart.item_total)}
              threshold_pence={view.threshold_pence}
            />
            {view.addon_only && <AddonNotice />}
            <BasketLines items={cart.items} />
          </div>
          <div className="border-t border-border bg-background px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg">
            <BasketSummary cart={cart} view={view} />
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-4">
          <BasketEmpty />
        </div>
      )}
    </div>
  )
}
