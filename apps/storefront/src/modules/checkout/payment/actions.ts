"use server"

import { CHECKOUT_CART_FIELDS } from "@lib/data/basket"
import { initiatePaymentSession, placeOrder, retrieveCart } from "@lib/data/cart"
import { reportUnexpected } from "@lib/monitoring/report"
import { unstable_rethrow } from "next/navigation"
import {
  HOLD_RELEASED,
  ORDER_FAILED,
  PAYMENT_NOT_AUTHORISED,
  SESSION_FAILED,
  STRIPE_PROVIDER_ID,
  findSession,
  intentIdFromSecret,
  isIntentId,
  providerForMode,
  sessionDecision,
  sessionErrorMessage,
} from "./helpers"
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

/**
 * The basket from the cookie, or null when there is none. Throws when the
 * backend cannot answer. `includeCompleted` also returns a basket that already
 * became an order (the payment webhook can finish before the browser does).
 */
async function loadCart(options?: { includeCompleted?: boolean }) {
  const cart = await retrieveCart(undefined, CHECKOUT_CART_FIELDS, options)
  return cart?.items?.length ? cart : null
}

const isCompleted = (cart: object) => Boolean((cart as { completed_at?: string | null }).completed_at)

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
  let cart: Awaited<ReturnType<typeof loadCart>>
  try {
    cart = await loadCart()
  } catch {
    return { ok: false, message: SESSION_FAILED }
  }
  if (!cart) return { ok: false, message: CART_GONE }
  const provider = providerForMode(await getPaymentMode(cart.region_id ?? ""))
  if (!provider) return { ok: false, message: SESSION_FAILED }
  try {
    await ensureSession(cart, provider)
    return { ok: true }
  } catch (e) {
    await reportUnexpected(e, "checkout.payment-session")
    return { ok: false, message: sessionErrorMessage(e) }
  }
}

/**
 * Stripe reported the form's PaymentIntent as cancelled (for example the backend
 * released the hold after refusing the order). The payment session can still
 * read "authorized" for the same total, so the page would mount the dead intent
 * again; this starts a new session instead. Only when the cancelled intent is
 * still the basket's own: if another tab already replaced it, the page simply
 * picks up the new one. The browser sends the intent id, never the secret.
 */
export async function replaceCancelledPayment(intentId: string): Promise<PaymentActionResult> {
  if (!isIntentId(intentId)) return { ok: false, message: SESSION_FAILED }
  let cart: Awaited<ReturnType<typeof loadCart>>
  try {
    cart = await loadCart()
  } catch {
    return { ok: false, message: SESSION_FAILED }
  }
  if (!cart) return { ok: false, message: CART_GONE }
  if ((await getPaymentMode(cart.region_id ?? "")) !== "stripe") return { ok: false, message: SESSION_FAILED }
  try {
    const current = findSession(cart.payment_collection, STRIPE_PROVIDER_ID)
    const secret = current?.data?.client_secret
    if (current && intentIdFromSecret(typeof secret === "string" ? secret : null) !== intentId) {
      // already replaced (another tab, or a total change): make sure it is usable
      await ensureSession(cart, STRIPE_PROVIDER_ID)
    } else {
      await initiatePaymentSession(cart, { provider_id: STRIPE_PROVIDER_ID })
    }
    return { ok: true }
  } catch (e) {
    await reportUnexpected(e, "checkout.payment-session")
    return { ok: false, message: sessionErrorMessage(e) }
  }
}

/**
 * Completes the cart. On success Medusa returns an order and `placeOrder`
 * redirects to the confirmation page. The backend authorises from its own
 * retrieve of the PaymentIntent; the browser's word is never used.
 * Manual mode (dev/CI only, see resolvePaymentMode) creates its session here.
 */
export async function completeOrder(): Promise<PaymentActionResult> {
  let cart: Awaited<ReturnType<typeof loadCart>>
  try {
    // A basket the webhook already completed still goes to the backend below:
    // completing it again answers with the order that exists.
    cart = await loadCart({ includeCompleted: true })
  } catch {
    return { ok: false, message: ORDER_FAILED }
  }
  if (!cart) return { ok: false, message: CART_GONE }
  const mode = await getPaymentMode(cart.region_id ?? "")
  if (mode === "unavailable") {
    return { ok: false, message: "Payments are unavailable right now. Please try again in a few minutes or call the shop." }
  }
  try {
    if (mode === "manual" && !isCompleted(cart)) await ensureSession(cart, providerForMode(mode)!)
    await placeOrder(cart.id)
  } catch (e) {
    // placeOrder's redirect to the confirmation page is thrown; let Next handle it
    unstable_rethrow(e)
    const refusal = e as { payment_released?: boolean; payment_not_authorised?: boolean } | null
    if (refusal?.payment_released) {
      return { ok: false, message: HOLD_RELEASED }
    }
    // the backend's own payment step refused: nothing is held, no order exists
    if (refusal?.payment_not_authorised) {
      return { ok: false, message: PAYMENT_NOT_AUTHORISED }
    }
    // the card may be authorised with no order: the shop must hear about it
    await reportUnexpected(e, "checkout.place-order")
    return { ok: false, message: ORDER_FAILED }
  }
  // placeOrder returned: the cart did not become an order
  return { ok: false, message: ORDER_FAILED }
}
