import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { completeCartWorkflowId } from "@medusajs/medusa/core-flows"
import { refetchCart } from "@medusajs/medusa/api/store/carts/helpers"
import { defaultStoreCartFields } from "@medusajs/medusa/api/store/carts/query-config"
import { completionRefusedBeforePayment } from "../../../../../lib/payment-hold"
import { releaseCartPaymentHoldWorkflow } from "../../../../../workflows/release-cart-payment-hold"

/** Completion errors the shopper can act on; Medusa answers these with 200 and the cart. */
const PAYMENT_ERRORS: string[] = [
  MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR,
  MedusaError.Types.PAYMENT_REQUIRES_MORE_ERROR,
]

/**
 * POST /store/carts/:id/complete
 *
 * Replaces Medusa's route of the same path (its middlewares still apply).
 * Same behaviour, plus: the shopper's card is authorised in the browser
 * before this call, and Medusa only cancels an authorisation that its own
 * authorise step made. When the cart is refused before that step, the hold
 * would stay on the card for days. Here it is released and the answer says
 * so: 200 `{ type: "cart", cart, error: { ..., payment_released: true } }`.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.id
  const engine = req.scope.resolve(Modules.WORKFLOW_ENGINE)
  const { errors, result, transaction } = await engine.run(completeCartWorkflowId, {
    input: { id: cartId },
    throwOnError: false,
  })
  if (!transaction.hasFinished()) {
    throw new MedusaError(MedusaError.Types.CONFLICT, "Cart is already being completed by another request")
  }

  const error = errors?.[0]?.error as (Error & { type?: string }) | undefined
  if (error) {
    const type = error.type ?? ""
    let released = false
    // Out of stock or a basket rule, refused before the payment step. Anything else (the payment
    // step itself, a conflict, a database error) may still complete later, so the hold stays.
    if (completionRefusedBeforePayment(errors?.[0])) {
      try {
        const { result: hold } = await releaseCartPaymentHoldWorkflow(req.scope).run({
          input: { cart_id: cartId },
        })
        released = hold.released > 0
      } catch (e) {
        // IDs only in logs. The hold stays; the shopper gets the original refusal.
        req.scope
          .resolve(ContainerRegistrationKeys.LOGGER)
          .error(`Releasing the payment hold of cart ${cartId} failed: ${(e as Error).message}`)
      }
    }
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
    filters: { id: (result as { id: string }).id },
  })
  res.status(200).json({ type: "order", order: data[0] })
}
