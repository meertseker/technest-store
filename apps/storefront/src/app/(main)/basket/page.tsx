import { Metadata } from "next"
import { AlertCircle } from "lucide-react"
import { retrieveCart } from "@lib/data/cart"
import { getBasketView } from "@lib/data/basket"
import { toPence } from "@lib/basket/money"
import AddonNotice from "@modules/basket/components/addon-notice"
import BasketEmpty from "@modules/basket/components/basket-empty"
import BasketLines from "@modules/basket/components/basket-lines"
import { itemCount } from "@modules/basket/components/basket-panel"
import BasketSummary from "@modules/basket/components/basket-summary"
import FreeDeliveryBar from "@modules/basket/components/free-delivery-bar"

export const metadata: Metadata = {
  title: "Your basket",
  robots: { index: false },
}

// Per-visitor content (cart cookie)
export const dynamic = "force-dynamic"

const RETURN_ERRORS: Record<string, string> = {
  payment_failed: "Your payment didn't go through, so you haven't been charged. Please try again.",
  order_failed: "We couldn't place your order. You haven't been charged. Please try again or call the shop.",
}

/**
 * /basket: the no-JS fallback and deep link for the basket drawer (spec 7.4).
 * 2 columns from 1024px: items 8/12 | summary 4/12 sticky.
 */
export default async function BasketPage(props: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await props.searchParams
  const cart = await retrieveCart().catch(() => null)
  const view = await getBasketView(cart)
  const count = itemCount(cart)
  const returnError = error ? RETURN_ERRORS[error] : undefined

  return (
    <div className="content-container py-8 lg:py-12" data-testid="cart-container">
      <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] lg:text-4xl">
        Your basket{count > 0 && <span className="font-normal text-muted-foreground"> ({count})</span>}
      </h1>
      {returnError && (
        <div
          role="alert"
          className="mt-4 flex gap-3 rounded border border-destructive p-3 text-base"
          data-testid="basket-return-error"
        >
          <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p>{returnError}</p>
        </div>
      )}
      {cart && count > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <section aria-label="Items" className="flex flex-col gap-4 lg:col-span-8">
            <FreeDeliveryBar
              subtotal_pence={toPence(cart.item_total)}
              threshold_pence={view.threshold_pence}
            />
            {view.addon_only && <AddonNotice />}
            <BasketLines items={cart.items} />
          </section>
          <aside aria-labelledby="basket-summary-title" className="lg:col-span-4">
            <div className="flex flex-col gap-4 rounded border border-border bg-surface p-4 lg:sticky lg:top-[calc(var(--header-h)+24px)]">
              <h2 id="basket-summary-title" className="text-lg font-semibold">
                Order summary
              </h2>
              <BasketSummary cart={cart} view={view} />
            </div>
          </aside>
        </div>
      ) : (
        <BasketEmpty />
      )}
    </div>
  )
}
