import { sdk } from "@lib/config"
import { placeOrder } from "@lib/data/cart"
import { getAuthHeaders, setCartId } from "@lib/data/cookies"
import { HttpTypes } from "@medusajs/types"
import { unstable_rethrow } from "next/navigation"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl

  const cartId = searchParams.get("cart_id")
  const paymentIntent = searchParams.get("payment_intent")
  const paymentIntentClientSecret = searchParams.get(
    "payment_intent_client_secret"
  )
  const redirectStatus = searchParams.get("redirect_status")

  // Every redirect below stays on this origin (UK-only site, no country prefix).
  // Errors go back to the payment step, which shows them in its error summary
  // (codes: modules/checkout/payment/helpers.ts returnErrorMessage).
  const backToPayment = (code: "payment_failed" | "declined" | "order_failed") =>
    NextResponse.redirect(`${origin}/checkout?step=payment&payment_error=${code}`)
  const rejected = () => backToPayment("payment_failed")

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

  await setCartId(cartId)

  // The customer backed out or the bank declined. Stripe puts the PaymentIntent
  // back into `requires_payment_method`, so the Payment Element can mount
  // against it again: return to the payment step and let them retry. The
  // client secret is not forwarded (it stays out of URLs we create).
  if (redirectStatus === "failed") {
    return backToPayment("declined")
  }

  try {
    await placeOrder(cartId)
  } catch (error) {
    unstable_rethrow(error)

    return backToPayment("order_failed")
  }

  // Only reached when the cart did not convert into an order.
  return backToPayment("order_failed")
}
