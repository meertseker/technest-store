/**
 * Checkout step order (spec 7.5): 1 Contact -> 2 Delivery -> 3 Payment.
 * "payment" and "review" are the `?step=` values E2's payment step reads
 * (modules/checkout/components/payment, review), so we keep those names.
 */
export type CheckoutStep = "contact" | "delivery" | "payment" | "review"

const RANK: Record<CheckoutStep, number> = { contact: 0, delivery: 1, payment: 2, review: 3 }

export type CartProgressLike = {
  email?: string | null
  shipping_address?: { first_name?: string | null } | null
  shipping_methods?: readonly unknown[] | null
}

export function isContactDone(cart: CartProgressLike): boolean {
  return !!cart.email
}

export function isDeliveryDone(cart: CartProgressLike): boolean {
  return (cart.shipping_methods?.length ?? 0) > 0 && !!cart.shipping_address?.first_name
}

export function firstIncompleteStep(cart: CartProgressLike): CheckoutStep {
  if (!isContactDone(cart)) return "contact"
  if (!isDeliveryDone(cart)) return "delivery"
  return "payment"
}

export function isCheckoutStep(v: unknown): v is CheckoutStep {
  return typeof v === "string" && v in RANK
}

/**
 * The step to show. An earlier step can always be reopened with "Edit";
 * a later one only once everything before it is done.
 */
export function resolveStep(requested: unknown, cart: CartProgressLike): CheckoutStep {
  const first = firstIncompleteStep(cart)
  if (!isCheckoutStep(requested)) return first
  // "review" belongs to E2's payment step, which checks its own readiness
  const limit = first === "payment" ? RANK.review : RANK[first]
  return RANK[requested] > limit ? first : requested
}

export function stepRank(step: CheckoutStep): number {
  return RANK[step]
}
