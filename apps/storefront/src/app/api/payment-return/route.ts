import { sdk } from "@lib/config"
import { placeOrder } from "@lib/data/cart"
import { getAuthHeaders, getCartId, setCartId } from "@lib/data/cookies"
import { HttpTypes } from "@medusajs/types"
import { seeOther } from "@lib/http/see-other"
import { unstable_rethrow } from "next/navigation"
import { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const cartId = searchParams.get("cart_id")
  const paymentIntent = searchParams.get("payment_intent")
  const paymentIntentClientSecret = searchParams.get(
    "payment_intent_client_secret"
  )
  const redirectStatus = searchParams.get("redirect_status")

  // Every redirect below stays on this site, so it is relative: in the Docker
  // image the request's own origin is the container's address, not the public host.
  // Errors go back to the payment step, which shows them in its error summary
  // (codes: modules/checkout/payment/helpers.ts returnErrorMessage).
  //
  // The basket in the link is only treated as the visitor's own when their
  // cookie already points at it, or when they have no basket (the cookie was
  // lost on the way back from the bank). A link for some other basket never
  // replaces the one they have: its outcome is shown on their own basket page.
  const cookieCartId = await getCartId()
  const ownBasket = !cookieCartId || cookieCartId === cartId
  type ReturnCode = "payment_failed" | "declined" | "order_failed" | "hold_released" | "processing"
  // The basket page has fewer notices; a payment still processing keeps its own
  // (never "failed": the shopper must not pay again).
  const basketCode = (code: ReturnCode) =>
    code === "processing" ? "processing" : code === "declined" || code === "payment_failed" ? "payment_failed" : "order_failed"
  const backToPayment = (code: ReturnCode) =>
    ownBasket
      ? seeOther(`/checkout?step=payment&payment_error=${code}`)
      : seeOther(`/basket?error=${basketCode(code)}`)
  const rejected = () => seeOther("/checkout?step=payment&payment_error=payment_failed")

  if (!cartId || !paymentIntent || !paymentIntentClientSecret) {
    return rejected()
  }

  const cart = await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${cartId}`, {
      method: "GET",
      query: { fields: "payment_collection.payment_sessions.data" },
      headers: { ...(await getAuthHeaders()) },
      cache: "no-store",
    })
    .then(({ cart }) => cart)
    .catch(() => null)

  const paymentSession = cart?.payment_collection?.payment_sessions?.find(
    (session) => session.data?.id === paymentIntent
  )

  if (
    !paymentSession ||
    paymentSession.data?.client_secret !== paymentIntentClientSecret
  ) {
    return rejected()
  }

  if (ownBasket) await setCartId(cartId)

  // The customer backed out or the bank declined. Stripe puts the PaymentIntent
  // back into `requires_payment_method`, so the Payment Element can mount
  // against it again: return to the payment step and let them retry. The
  // client secret is not forwarded (it stays out of URLs we create).
  if (redirectStatus === "failed") {
    return backToPayment("declined")
  }

  // The bank has not decided yet (some bank-transfer and wallet methods). The
  // intent is not authorised, so completing now would only be refused; the
  // payment webhook completes the basket when the bank confirms.
  if (redirectStatus === "processing") {
    return backToPayment("processing")
  }

  try {
    await placeOrder(cartId)
  } catch (error) {
    unstable_rethrow(error)

    const refusal = error as { payment_released?: boolean; payment_not_authorised?: boolean } | null
    // Each outcome in its own words: a released hold, a payment that was never
    // authorised (nothing held), or an authorised payment without an order.
    return backToPayment(
      refusal?.payment_released ? "hold_released" : refusal?.payment_not_authorised ? "payment_failed" : "order_failed"
    )
  }

  // Only reached when the cart did not convert into an order.
  return backToPayment("order_failed")
}
