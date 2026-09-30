import { HttpTypes } from "@medusajs/types"
import { AlertCircle } from "lucide-react"
import {
  findSession,
  providerForMode,
  returnErrorMessage,
  sessionDecision,
  toPence,
  toStripeSessionView,
} from "./helpers"
import { getPaymentMode, stripePublishableKey } from "./mode"
import PaymentForm from "./payment-form"

/**
 * Step 3 body (owner: E2). Decides the payment path on the server, hands the
 * client only what it needs (client secret + Klarna flag, never the rest of
 * the PaymentIntent) and says whether the session must be (re)initiated.
 */
export default async function PaymentStep({
  cart,
  isCollect,
  paymentError,
}: {
  cart: HttpTypes.StoreCart
  isCollect: boolean
  paymentError?: string | null
}) {
  const mode = await getPaymentMode(cart.region?.id ?? cart.region_id ?? "")
  const provider = providerForMode(mode)

  if (mode === "unavailable" || !provider) {
    return (
      <p role="alert" className="flex items-start gap-2 font-medium text-destructive" data-testid="payment-unavailable">
        <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0" />
        Card payments are unavailable right now. Please try again in a few minutes or call the shop.
      </p>
    )
  }

  const collection = cart.payment_collection
  const needsSession = sessionDecision({ collection, providerId: provider, cartTotal: cart.total }) === "create"
  const session = mode === "stripe" && !needsSession ? toStripeSessionView(findSession(collection, provider)) : null
  const addr = cart.billing_address ?? cart.shipping_address

  return (
    <PaymentForm
      mode={mode}
      stripeKey={mode === "stripe" ? stripePublishableKey() : undefined}
      session={session}
      needsSession={needsSession}
      cartId={cart.id}
      total_pence={toPence(cart.total)}
      isCollect={isCollect}
      billing={{
        name: [addr?.first_name, addr?.last_name].filter(Boolean).join(" "),
        email: cart.email ?? "",
        phone: addr?.phone ?? undefined,
      }}
      returnError={returnErrorMessage(paymentError)}
    />
  )
}
