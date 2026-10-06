import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { completeCartWorkflowId } from "@medusajs/medusa/core-flows"
import { releaseCartPaymentHoldWorkflow } from "../workflows/release-cart-payment-hold"
import { completionRefusedBeforePayment } from "./payment-hold"
import { reportError } from "./alerting"

export type CartCompletion =
  /** Another completion of this cart is still running. */
  | { outcome: "busy" }
  | { outcome: "order"; order_id: string }
  | {
      outcome: "refused"
      error: Error & { type?: string }
      /** True when the card hold was released because the refusal is final. */
      payment_released: boolean
    }

/**
 * Completes a cart with Medusa's completeCartWorkflow. The shopper's card is
 * authorised in the browser before completion, and Medusa only cancels an
 * authorisation its own authorise step made: when the cart is refused before
 * that step (out of stock, a basket rule) the hold would stay on the card for
 * days, so it is released here. Used by the store route and the reconcile job.
 */
export async function completeCartReleasingHold(
  container: MedusaContainer,
  cartId: string
): Promise<CartCompletion> {
  const engine = container.resolve(Modules.WORKFLOW_ENGINE)
  const { errors, result, transaction } = await engine.run(completeCartWorkflowId, {
    input: { id: cartId },
    throwOnError: false,
  })
  if (!transaction.hasFinished()) return { outcome: "busy" }

  const error = errors?.[0]?.error as (Error & { type?: string }) | undefined
  if (!error) return { outcome: "order", order_id: (result as { id: string }).id }

  let released = false
  // Out of stock or a basket rule, refused before the payment step. Anything else (the payment
  // step itself, a conflict, a database error) may still complete later, so the hold stays.
  if (completionRefusedBeforePayment(errors?.[0])) {
    try {
      const { result: hold } = await releaseCartPaymentHoldWorkflow(container).run({
        input: { cart_id: cartId },
      })
      released = hold.released > 0
    } catch (e) {
      // IDs only in logs. The hold stays; the caller gets the original refusal.
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .error(`Releasing the payment hold of cart ${cartId} failed: ${(e as Error).message}`)
      reportError(e, { source: "cart-completion:release-hold", cart_id: cartId })
    }
  }
  return { outcome: "refused", error, payment_released: released }
}
