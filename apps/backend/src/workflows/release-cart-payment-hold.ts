import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { lockOwnerStep } from "./steps/lock-owner"

export type ReleaseCartPaymentHoldInput = { cart_id: string }

type SessionRow = {
  id: string
  payment?: { id: string; captured_at?: unknown; canceled_at?: unknown } | null
}

/**
 * Releases the card hold of a cart that could not become an order: each
 * payment session is deleted, or its payment cancelled when the webhook
 * already authorised it. Either cancels the PaymentIntent at Stripe. Nothing
 * is released for a cart that has an order, or for a captured payment.
 *
 * A released hold can't be put back, so there is no compensation: the
 * shopper pays again with a new session.
 */
export const releaseCartPaymentHoldStep = createStep(
  "release-cart-payment-hold",
  async ({ cart_id }: ReleaseCartPaymentHoldInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order_cart",
      fields: ["order_id"],
      filters: { cart_id },
    })
    if (orders.length) return new StepResponse({ released: 0 })

    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "payment_collection.payment_sessions.id",
        "payment_collection.payment_sessions.payment.id",
        "payment_collection.payment_sessions.payment.captured_at",
        "payment_collection.payment_sessions.payment.canceled_at",
      ],
      filters: { id: cart_id },
    })
    const sessions = ((carts[0] as any)?.payment_collection?.payment_sessions ?? []) as (SessionRow | null)[]
    const payments = container.resolve(Modules.PAYMENT)
    let released = 0
    for (const session of sessions) {
      if (!session) continue
      if (session.payment) {
        if (session.payment.captured_at || session.payment.canceled_at) continue
        await payments.cancelPayment(session.payment.id)
      } else {
        await payments.deletePaymentSession(session.id)
      }
      released++
    }
    return new StepResponse({ released })
  }
)

/**
 * Runs under the cart's own lock (the key completeCartWorkflow and the webhook
 * use), so a completion can't create an order between the "no order" check
 * and the release.
 */
export const releaseCartPaymentHoldWorkflow = createWorkflow(
  "release-cart-payment-hold",
  function (input: ReleaseCartPaymentHoldInput) {
    const owner = lockOwnerStep({ workflow: "release-cart-payment-hold" })
    const lock = transform({ input, owner }, ({ input, owner }) => ({
      ownerId: owner,
      key: input.cart_id,
      timeout: 5,
      ttl: 30,
    }))
    acquireLockStep(lock)
    const released = releaseCartPaymentHoldStep(input)
    const unlock = transform({ input, owner }, ({ input, owner }) => ({
      key: input.cart_id,
      ownerId: owner,
    }))
    releaseLockStep(unlock)
    return new WorkflowResponse(released)
  }
)
