import { klarnaBasketHint } from "./helpers"

/**
 * Basket drawer and /basket (owner: E2): "Klarna is available on orders over £30"
 * from the admin setting. Display only; the payment session decides at checkout.
 */
export default function KlarnaBasketHint({
  total_pence,
  min_pence,
}: {
  total_pence: number
  min_pence: number | null | undefined
}) {
  const text = klarnaBasketHint(total_pence, min_pence)
  if (!text) return null
  return (
    <p className="text-center text-sm text-muted-foreground" data-testid="klarna-basket-hint">
      {text}
    </p>
  )
}
