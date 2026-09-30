"use server"

import { CHECKOUT_CART_FIELDS } from "@lib/data/basket"
import { initiatePaymentSession, placeOrder, retrieveCart } from "@lib/data/cart"
import { unstable_rethrow } from "next/navigation"
import { ORDER_FAILED, SESSION_FAILED, providerForMode, sessionDecision } from "./helpers"
import { getPaymentMode } from "./mode"

/**
 * Payment step server actions (owner: E2). The browser sends nothing but the
 * call itself: the cart comes from the cookie, the provider from the server's
 * own mode decision, and the payment session gets only `provider_id`
 * (docs/contracts/payments.md: sending `data` is rejected by the backend).
 * Nothing here logs card data, client secrets or PII.
 */
export type PaymentActionResult = { ok: true } | { ok: false; message: string }

const CART_GONE = "Your basket has changed or expired. Please go back to your basket and try again."

async function loadCart() {
  const cart = await retrieveCart(undefined, CHECKOUT_CART_FIELDS)
  return cart?.items?.length ? cart : null
}

async function ensureSession(cart: NonNullable<Awaited<ReturnType<typeof loadCart>>>, providerId: string) {
  const decision = sessionDecision({
    collection: cart.payment_collection,
    providerId,
    cartTotal: cart.total,
  })
  if (decision === "reuse") return
  await initiatePaymentSession(cart, { provider_id: providerId })
}

/** Creates the payment session if the cart has none for its current total (e.g. after a delivery change) */
export async function preparePaymentSession(): Promise<PaymentActionResult> {
  const cart = await loadCart()
  if (!cart) return { ok: false, message: CART_GONE }
  const provider = providerForMode(await getPaymentMode(cart.region_id ?? ""))
  if (!provider) return { ok: false, message: SESSION_FAILED }
  try {
    await ensureSession(cart, provider)
    return { ok: true }
  } catch {
    return { ok: false, message: SESSION_FAILED }
  }
}

/**
 * Completes the cart. On success Medusa returns an order and `placeOrder`
 * redirects to the confirmation page. The backend authorises from its own
 * retrieve of the PaymentIntent; the browser's word is never used.
 * Manual mode (dev/CI only, see resolvePaymentMode) creates its session here.
 */
export async function completeOrder(): Promise<PaymentActionResult> {
  const cart = await loadCart()
  if (!cart) return { ok: false, message: CART_GONE }
  const mode = await getPaymentMode(cart.region_id ?? "")
  if (mode === "unavailable") {
    return { ok: false, message: "Payments are unavailable right now. Please try again in a few minutes or call the shop." }
  }
  try {
    if (mode === "manual") await ensureSession(cart, providerForMode(mode)!)
    await placeOrder(cart.id)
  } catch (e) {
    // placeOrder's redirect to the confirmation page is thrown; let Next handle it
    unstable_rethrow(e)
    return { ok: false, message: ORDER_FAILED }
  }
  // placeOrder returned: the cart did not become an order
  return { ok: false, message: ORDER_FAILED }
}
