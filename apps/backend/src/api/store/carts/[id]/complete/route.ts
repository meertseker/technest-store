import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { refetchCart } from "@medusajs/medusa/api/store/carts/helpers"
import { defaultStoreCartFields } from "@medusajs/medusa/api/store/carts/query-config"
import { completeCartReleasingHold } from "../../../../../lib/cart-completion"

/** Completion errors the shopper can act on; Medusa answers these with 200 and the cart. */
const PAYMENT_ERRORS: string[] = [
  MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR,
  MedusaError.Types.PAYMENT_REQUIRES_MORE_ERROR,
]

/**
 * POST /store/carts/:id/complete
 *
 * Replaces Medusa's route of the same path (its middlewares still apply).
 * Same behaviour, plus: when the cart is refused before Medusa's own
 * authorise step, the hold already on the shopper's card is released
 * (lib/cart-completion.ts) and the answer says so:
 * 200 `{ type: "cart", cart, error: { ..., payment_released: true } }`.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.id
  const completion = await completeCartReleasingHold(req.scope, cartId)
  if (completion.outcome === "busy") {
    throw new MedusaError(MedusaError.Types.CONFLICT, "Cart is already being completed by another request")
  }

  if (completion.outcome === "refused") {
    const { error, payment_released: released } = completion
    const type = error.type ?? ""
    if (!released && !PAYMENT_ERRORS.includes(type)) {
      throw error
    }
    const cart = await refetchCart(cartId, req.scope, defaultStoreCartFields)
    res.status(200).json({
      type: "cart",
      cart,
      error: {
        message: error.message,
        name: error.name,
        type,
        ...(released ? { payment_released: true } : {}),
      },
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: req.queryConfig.fields,
    filters: { id: completion.order_id },
  })
  res.status(200).json({ type: "order", order: data[0] })
}
