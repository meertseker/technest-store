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
  const backToPayment = (code: "payment_failed" | "declined" | "order_failed" | "hold_released") =>
    ownBasket
      ? seeOther(`/checkout?step=payment&payment_error=${code}`)
      : seeOther(`/basket?error=${code === "declined" || code === "payment_failed" ? "payment_failed" : "order_failed"}`)
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

  try {
    await placeOrder(cartId)
  } catch (error) {
    unstable_rethrow(error)

    return backToPayment(
      (error as { payment_released?: boolean } | null)?.payment_released ? "hold_released" : "order_failed"
    )
  }

  // Only reached when the cart did not convert into an order.
  return backToPayment("order_failed")
}
